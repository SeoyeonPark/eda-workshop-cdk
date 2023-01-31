import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { IpAddresses } from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Duration } from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EdaWSNetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly repository: ecr.Repository;
  public readonly databaseCluster: rds.DatabaseCluster;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cidr = '10.0.0.0/16';

    // ECR
    const repoName = "eda-sample-coffee-app";
    const repoExistCheck = ecr.Repository.fromRepositoryName(this, 'EdaEcrRepositoryCheck', repoName);
    console.log(repoExistCheck)
    // const repoExist = new CfnCondition(this, "RepoExist", {
    //   expression: Fn.if
    // })
    this.repository = new ecr.Repository(this, "EdaEcrRepository", {
      repositoryName: repoName,
    });
    

    // VPC, Subnet, Nat Gateway, Internet Gateway, route tables
    this.vpc = new ec2.Vpc(this, 'EdaWorkshopVpc', {
      vpcName: 'vpc-eda-workshop',
      ipAddresses: IpAddresses.cidr(cidr),
      natGateways: 1,
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private-ecs',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'private-aurora',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ],
    });

    // Aurora Security Group, Cluster
    const auroraSecurityGroup = new ec2.SecurityGroup(this, 'aurora-sg', {
      vpc: this.vpc,
      securityGroupName: 'aurora-SG',
      allowAllOutbound: true
    });
    auroraSecurityGroup.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(3306), 'aurora mysql inbound')

    const auroraSecret = new secretsmanager.Secret(this, 'AuroraSecret', {
      secretName: '/secret/db/eda-ws-coffee',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: "edasample",
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    this.databaseCluster = new rds.DatabaseCluster(this, 'EdaSampleDB', {
      defaultDatabaseName: 'dbEdaCoffee',
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_02_0
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
        vpc: this.vpc,
        publiclyAccessible: false,
        securityGroups: [
          auroraSecurityGroup
        ],
      },
      credentials: rds.Credentials.fromSecret(auroraSecret),
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}

// Shrae resources between stacks
interface EdaWsEcsStackProps extends StackProps {
  vpc: ec2.Vpc;
  repository: ecr.Repository;
  databaseCluster: rds.DatabaseCluster;
}

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

export class EdaWSSqsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // TODO SQS 추가

  }
}

export class EdaWSSnsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // TODO SNS 추가

  }
}