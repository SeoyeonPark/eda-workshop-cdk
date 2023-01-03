import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";


export class CdkEdaWorkshopStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cidr = '10.0.0.0/16';

    const vpc = new ec2.Vpc(this, 'EdaWorkshopVpc', {
      vpcName: 'vpc-eda-workshop',
      cidr: cidr,
      natGateways: 1,
      maxAzs: 3,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 24,
          name: 'private-ecs',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        {
          cidrMask: 28,
          name: 'private-aurora',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ],
    });

    const auroraSecurityGroup = new ec2.SecurityGroup(this, 'aurora-sg', {
      vpc: vpc,
      securityGroupName: 'aurora-SG',
      allowAllOutbound: true
    });
    auroraSecurityGroup.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(3306), 'aurora mysql inbound')

    const auroraCluster = new rds.DatabaseCluster(this, 'EdaSampleDB', {
      defaultDatabaseName: 'edasample',
      engine: rds.DatabaseClusterEngine.auroraMysql({version: rds.AuroraMysqlEngineVersion.VER_3_02_1}),
      credentials: rds.Credentials.fromGeneratedSecret('edasample', {
        secretName: 'eda-sample-order',
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
        vpc,
        publiclyAccessible: false,
        securityGroups: [
          auroraSecurityGroup
        ],
        
      },
    })

    // ECS Task, application 넣기
    // CodeBuild, CodeDeploy

    const cluster = new ecs.Cluster(this, "EdaEcsCluster", {
        vpc: vpc
    });

    const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'EdaWSFargateSvc', {
      cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      desiredCount: 2,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: "test environment variable 1 value",
          TEST_ENVIRONMENT_VARIABLE2: "test environment variable 2 value",
        },
      },
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        // subnets: [ec2.Subnet.fromSubnetId(this, 'private-ecs', 'VpcISOLATEDSubnet1Subnet80F07FA0')],
      },
    });

    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/custom-health-path",
    });

    // new ecs_patterns.ApplicationLoadBalancedFargateService(this, "EdaFargateSvc", {
    //   cluster: cluster,
    //   cpu: 512,
    //   desiredCount: 3,
    //   taskImageOptions: { image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample") },
    //   taskSubnets: {
    //     subnets: [ec2.Subnet.fromSubnetId(this, 'subnet', )]
    //   }
    //   memoryLimitMiB: 1024,
    //   publicLoadBalancer: true
    // });
  }
}
