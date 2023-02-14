import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Duration } from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import { EdaWsEcsStackProps } from './stack-1-infra'

export class EdaWSEcsStack extends Stack {
    constructor(scope: Construct, id: string, props: EdaWsEcsStackProps) {
      super(scope, id, props);
  
      const {vpc, repository, databaseCluster} = props;
  
      // IAM Policy for ECS
      const ecsTaskPolicy = new iam.PolicyStatement({
        resources: ['*'],
        actions: [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt",
          "rds:*"
        ],
      });
      const ecsExecutionPolicy = new iam.PolicyStatement({
        resources: ['*'],
        actions: [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "secretsmanager:GetSecretValue",
          "kms:Decrypt",
        ],
      });
  
      // ECS Cluster, Task Definition, ALB
      const cluster = new ecs.Cluster(this, "EdaEcsCluster", {
          vpc: vpc,
          clusterName: 'eda-ws-cluster-coffee'
      });
  
      const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
        memoryLimitMiB: 1024,
        cpu: 512,
        family: 'eda-ws-task'
      });
      fargateTaskDefinition.addToExecutionRolePolicy(ecsExecutionPolicy);
      fargateTaskDefinition.addToTaskRolePolicy(ecsTaskPolicy);
  
      const container = fargateTaskDefinition.addContainer("app", {
        containerName: 'coffee-app',
        image: ecs.ContainerImage.fromEcrRepository(repository),
        logging: ecs.LogDrivers.awsLogs({streamPrefix: 'eda-ws'}),
        environment: { 
          SPRING_PROFILES_ACTIVE: "dev",
        }
      });
      container.addPortMappings({
        containerPort: 8080,
      });
  
      const sg_service = new ec2.SecurityGroup(this, 'EdaWSFargateSG', { vpc: vpc });
      sg_service.addIngressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.tcp(8080));
  
      const service = new ecs.FargateService(this, 'EdaWSFargateSvc', {
        cluster,
        serviceName: 'eda-ws-svc-coffee',
        taskDefinition: fargateTaskDefinition,
        desiredCount: 2,
        assignPublicIp: false,
        securityGroups: [sg_service]
      });
  
      const scaling = service.autoScaleTaskCount({ maxCapacity: 4, minCapacity: 2 });
      scaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: Duration.seconds(60),
        scaleOutCooldown: Duration.seconds(60)
      });
  
      const lb = new elbv2.ApplicationLoadBalancer(this, 'EdaWSALB', {
        vpc,
        internetFacing: true,
        loadBalancerName: 'eda-ws-lb-coffee'
      });
  
      const listener = lb.addListener('lb-eda-ws-listener', {
        port: 80,
      });
  
      listener.addTargets('EdaWSTarget', {
        port: 80,
        targets: [service],
        targetGroupName: 'eda-ws-targetgroup',
        healthCheck: { path: '/actuator/health' }
      });
      listener.connections.allowDefaultPortFromAnyIpv4('Allow all traffic');
    }
  }