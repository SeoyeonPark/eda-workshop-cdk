import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { IpAddresses } from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
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
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.XLARGE8),
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
export interface EdaWsEcsStackProps extends StackProps {
  vpc: ec2.Vpc;
  repository: ecr.Repository;
  databaseCluster: rds.DatabaseCluster;
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