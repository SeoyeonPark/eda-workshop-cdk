import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { IpAddresses } from 'aws-cdk-lib/aws-ec2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EdaWSNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cidr = '10.0.0.0/16';

    // ECR
    this.repository = new ecr.Repository(this, "EdaEcrRepository", {
      repositoryName: "eda-sample-coffee-app",
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


    const auroraCluster = new rds.DatabaseCluster(this, 'EdaSampleDB', {
      defaultDatabaseName: 'dbEdaCoffee',
      engine: rds.DatabaseClusterEngine.auroraMysql({version: rds.AuroraMysqlEngineVersion.VER_3_02_1}),
      credentials: rds.Credentials.fromGeneratedSecret('edasample', {
        secretName: 'db-secret-eda-ws-coffee',
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
        vpc: this.vpc,
        publiclyAccessible: false,
        securityGroups: [
          auroraSecurityGroup
        ],
        
      },
    });
  }
}

// Shrae resources between stacks
interface EdaWsEcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  repository: ecr.Repository;
}

export class EdaWSEcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EdaWsEcsStackProps) {
    super(scope, id, props);

    const {vpc, repository} = props;

    // IAM Policy for ECS
    const ecsPolicy = new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        "secretsmanager:GetSecretValue",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
      ],
    })

    // ECS Cluster, Task Definition, ALB
    const cluster = new ecs.Cluster(this, "EdaEcsCluster", {
        vpc: vpc,
        clusterName: 'ecs-cluster-coffee'
    });


    const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'EdaWSFargateSvc', {
      cluster,
      serviceName: 'ecs-svc-eda-coffee-app',
      loadBalancerName: 'lb-eda-ws-coffee',
      memoryLimitMiB: 1024,
      cpu: 512,
      desiredCount: 2,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(repository),
        environment: {
          SPRING_PROFILES_ACTIVE: "dev",
        },
      },
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    loadBalancedFargateService.taskDefinition.addToTaskRolePolicy(ecsPolicy)

    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/",
    });
  }
}

export class EdaWSSqsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // TODO SQS 추가

  }
}

export class EdaWSSnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // TODO SNS 추가

  }
}