#!groovy
@Library('cicd-lib')

import jenkins.model.*

import vdmtl.cicd.*
import vdmtl.cicd.deployment.TargetEnv
import vdmtl.cicd.http.HttpUtils

import java.awt.Color

pipeline = new Pipeline()

// For more information on the configuration options,
// see https://bitbucket.org/villemontreal/cicd-lib/src/master/docs/Config.md
ctx = pipeline.createContext([
        namespace: ["core", "libs"],
        application: [
                name: "express-idempotency-mongo-adapter",
                type: "lib", // service, lib, containerImage, package
                runtime: "nodejs",
                description: "Générateur de code pour dépendance OpenAPI",
                keywords: [
                    "express",
                    "idempotency",
                    "nodejs",
                    "lib",
                ],
        ],
        packaging: [
                dockerfilePath: "Dockerfile"
        ],
        notifications: [
                chat: [
                    room: "SAI - Architecture - Ops",
                    notify: true
                ],
        ],
])

pipeline.start(ctx) {

    pipeline.withSourceCode(ctx) {

        pipeline.buildStage(ctx) {
            pipeline.buildDockerImage(ctx)
        }

        pipeline.prePublishStage(ctx) {
            pipeline.publishDraftDockerImage(ctx)
        }
    }

    pipeline.withDraftDockerImage(ctx) {
        pipeline.testInDraftDockerContainerStage(ctx) {}

        pipeline.publishStage(ctx) {

            // Determine the tag version, based on branch name
            def pkgFilename = "${ctx.dockerfileWorkingDir}/package.json";
            def pkgText = sh script: "cat ${pkgFilename}", returnStdout: true
            def pkg = HttpUtils.parseJson(pkgText);
            def version = pkg.version;
            String tag;
            if (ctx.target.env == TargetEnv.dev) {
                def currentDate = new Date().format('yyyyMMdd');
                version = pkg.version + "-pre.build.${currentDate}.${ctx.script.env.BUILD_NUMBER}";
                sh "cd ${ctx.dockerfileWorkingDir} && npm --no-git-tag-version version ${version}"
                tag = "next";
            }
            else {
                tag = "latest";
            }

            // Publish
            sh "cd ${ctx.dockerfileWorkingDir} npm --no-git-tag-version version ${version}"
            createNpmrc(ctx, "${ctx.dockerfileWorkingDir}/dist");
            returnStatusCode = sh returnStatus: true, script: "cd ${ctx.dockerfileWorkingDir} && npm publish --tag ${tag} --unsafe-perm --registry ${env.LIB_REPO_HOST} --userconfig .npmrc";

            if (returnStatusCode == 0) {
                ctx.logger.info("La version ${version} de la librairie à été publiée dans Nexus.");
                chatNotify(ctx, Strings.publication.success(ctx.config.application.name, version), true, Color.GREEN);
            } else {
                chatNotify(ctx, "Échec dans la publication de la ${version} de la librairie ${ctx.config.application.name}.", true, Color.RED);
                throw new Exception("Une erreur est survenue lors de la publication")
            }
        }

    }
}

def chatNotify(PipelineContext ctx, String message, Boolean notify, Color color) {
    ctx.chatNotify(message, notify, color);
}

def createNpmrc(PipelineContext ctx, String dir) {
	String npmrcFilename = "${dir}/.npmrc";
	def npmrcFileExists = fileExists npmrcFilename;
	ctx.logger.debug("url du .npmrc = " + npmrcFilename);
	// TODO corriger le npmrcFileExists, pour l'instant ce n'est pas très grave, le script ovverride le .npmrc existant.
	if (!npmrcFileExists) {
		ctx.logger.debug("le .npmrc n'existe pas");
		sh "cd ${dir} && echo \"save-exact=true\n" +
				"save-prefix=\n" +
				"@villemontreal:registry=${env.LIB_REPO_HOST}\" > .npmrc";
		if (ctx.debugMode)
			sh "cat ${dir}/.npmrc";
	}
	withCredentials([[$class: 'StringBinding', credentialsId: env.LIB_REPO_CRED_ID, variable: 'TOKEN']]) {
		sh "cd ${dir} && echo '//${env.LIB_REPO_HOST.substring(8)}:_authToken=' >> .npmrc";
		sh "cd ${dir} && sed -i '\$s/\$/${env.TOKEN}/' .npmrc";
		if (ctx.debugMode)
			sh "cat ${dir}/.npmrc";
	}
}