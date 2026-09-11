/**
 * Ready-to-review example inputs. Selecting one populates the textarea via the
 * form's existing onChange, so the review flow is completely unchanged.
 */
export interface Example {
  id: string
  label: string
  content: string
}

const kiroTaskPlan = `# Kiro task plan: add rate limiting to /review

Goal: protect the review endpoint from abuse.

Tasks:
1. Add a token-bucket limiter (100 req / 5 min per IP) in the Lambda handler.
2. Return HTTP 429 with a Retry-After header when the bucket is empty.
3. Store counters in an in-memory map keyed by source IP.
4. Add unit tests for the limiter (allow, deny, refill).
5. Update the README with the new limit.

Rollout: deploy to the main branch and watch CloudWatch for 429 rates.
No schema or IAM changes. Rollback is a straight revert of the handler change.`

const riskyServerlessDeployment = `service: payments-api
provider:
  name: aws
  runtime: nodejs18.x
  stage: prod
  environment:
    DB_PASSWORD: "hunter2-prod-primary"
    STRIPE_SECRET_KEY: "sk_live_51H..."
functions:
  charge:
    handler: src/charge.handler
    timeout: 3
    memorySize: 128
    events:
      - http:
          path: charge
          method: post
          cors: true
# No health checks, no alarms, no dead-letter queue.
# Deploys straight to 100% of prod traffic on every push to main.
# Database migrations run inline at cold start with no rollback path.`

const broadIamPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowEverything",
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    },
    {
      "Sid": "PassAnyRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "*"
    }
  ]
}

# Attached to the CI deployment role used by the pipeline.
# No permission boundary, no conditions, no MFA requirement.`

export const EXAMPLES: readonly Example[] = [
  { id: 'kiro-task-plan', label: 'Kiro task plan', content: kiroTaskPlan },
  {
    id: 'risky-serverless',
    label: 'Risky serverless deploy',
    content: riskyServerlessDeployment,
  },
  { id: 'broad-iam', label: 'Broad IAM policy', content: broadIamPolicy },
]
