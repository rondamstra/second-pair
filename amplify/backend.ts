import { defineBackend } from '@aws-amplify/backend'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Stack } from 'aws-cdk-lib'
import { NOVA_MODEL_ID, review } from './functions/review/resource.js'

const backend = defineBackend({
  review,
})

const apiStack = backend.createStack('SecondPairApi')
const region = Stack.of(apiStack).region
const account = Stack.of(apiStack).account

/**
 * Least-privilege Bedrock permission: allow the review function to invoke only
 * the configured Nova model. `bedrock:InvokeModel` is the sole action; no
 * wildcards on the service or resource beyond what the model requires.
 *
 * The configured id may be either a plain foundation-model id
 * (e.g. "amazon.nova-lite-v1:0") or a cross-region inference profile id
 * (e.g. "us.amazon.nova-lite-v1:0"). We grant the matching ARN(s): the
 * foundation-model ARN always, plus the inference-profile ARN and its underlying
 * regional foundation-model ARNs when a profile prefix is present.
 */
const modelResources = buildBedrockModelArns(NOVA_MODEL_ID, region, account)

backend.review.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'InvokeConfiguredNovaModel',
    effect: iam.Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: modelResources,
  }),
)

/**
 * API Gateway HTTP API (v2) with CORS enabled so the Amplify-hosted SPA can call
 * it from the browser. A single route: POST /review -> review function.
 */
const httpApi = new apigwv2.HttpApi(apiStack, 'SecondPairHttpApi', {
  apiName: 'second-pair-review-api',
  corsPreflight: {
    // The Amplify Hosting origin is not known at synth time. '*' permits the
    // hosted frontend to call the API; tighten to the exact origin in
    // production by replacing this with your app's amplifyapp.com URL.
    allowOrigins: ['*'],
    allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
    allowHeaders: ['content-type'],
  },
})

httpApi.addRoutes({
  path: '/review',
  methods: [apigwv2.HttpMethod.POST],
  integration: new HttpLambdaIntegration(
    'ReviewIntegration',
    backend.review.resources.lambda,
  ),
})

/**
 * Expose the deployed endpoint to the frontend via amplify_outputs.json. The SPA
 * reads `custom.reviewApiUrl` at runtime, so there is no hard-coded production URL.
 */
backend.addOutput({
  custom: {
    reviewApiUrl: `${httpApi.apiEndpoint}/review`,
    bedrockModelId: NOVA_MODEL_ID,
    region,
  },
})

/**
 * Builds the set of Bedrock ARNs to authorize for a given model id.
 */
function buildBedrockModelArns(
  modelId: string,
  region: string,
  account: string,
): string[] {
  // Cross-region inference profiles are prefixed with a geo scope like
  // "us.", "eu.", or "apac." followed by the underlying foundation-model id.
  const profileMatch = /^([a-z]+)\.(.+)$/.exec(modelId)
  const isInferenceProfile =
    profileMatch !== null && ['us', 'eu', 'apac'].includes(profileMatch[1] ?? '')

  if (isInferenceProfile) {
    const baseModelId = profileMatch![2]!
    return [
      // The inference profile itself.
      `arn:aws:bedrock:${region}:${account}:inference-profile/${modelId}`,
      // The foundation model in this region (profiles route to it).
      `arn:aws:bedrock:${region}::foundation-model/${baseModelId}`,
      // Profiles may fan out across regions; authorize the base model in any
      // region while keeping the action and model id tightly scoped.
      `arn:aws:bedrock:*::foundation-model/${baseModelId}`,
    ]
  }

  return [`arn:aws:bedrock:${region}::foundation-model/${modelId}`]
}
