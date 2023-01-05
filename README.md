# EDA Workshop CDK for Coffee application


The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
* `cdk deploy`      deploy this stack to your default AWS account/region




# Architecture Diagram

![Monolithic_architecture](./images/architecture_monolith.png)

# Deploy workshop stacks
## 1. Set AWS Profile

_TODO_

## 2. Deploy VPC, Database, ECR

Deploy VPC, Database, ECR to AWS cloud.

It takes about 15 minutes. Please go to step 3 while cdk deploying the resources.

```
cdk deploy stack-1-infra --require-approval never
```

## 3. Push docker images from sample-eda-spring application sourcecode.

Use cli commands on README.md from [Sample Coffee Application](https://github.com/SeoyeonPark/sample-eda-spring).

It takes about 3 minutes.

## 4. Deploy ECS Cluster, Task Definition, ALB

After you build docker image and push it to Amazon ECR that created in the above step, then deploy ECS stack to the AWS cloud.

It takes about 5 minutes.

```
cdk deploy stack-2-ecs --require-approval never
```

# Troubleshooting

When error occured during deploy cloudformation stack and rollbacked, then delete cloudformation stack and re-deploy the stack.

```
aws cloudformation delete-stack --stack-name stack-1-infra
```

# Clean up

1. Delete CloudFormation stack
```
cdk destroy --all
```

2. Manually delete Amazon ECR repository. This command also delete all images in the repository.

```
aws ecr delete-repository --force --repository-name eda-sample-coffee-app
```

