import {
  Construct,
  Stack,
  StackProps,
  Expiration,
  Duration,
  CfnOutput,
} from "@aws-cdk/core";
import { Vpc, SubnetType } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import {
  Cluster,
  FargateTaskDefinition,
  ContainerImage,
  Protocol,
  FargateService,
} from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";

interface CdkStackStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
}

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props: CdkStackStackProps) {
    super(scope, id, props);

    /**
     * Get var from props
     */
    const { prefix, stage } = props;

    //---------------------------------------------------------------------------
    /**
     * VPC
     */
    const vpc = new Vpc(this, `${prefix}-${stage}-VPC`, {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${prefix}-${stage}-ingress`,
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${prefix}-${stage}-application`,
          subnetType: SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: `${prefix}-${stage}-database`,
          subnetType: SubnetType.ISOLATED,
        },
      ],
    });

    //---------------------------------------------------------------------------
    /**
     * ECS
     */

    /**
     * ECS Cluster
     */
    const ecsCluster = new Cluster(this, `${prefix}-${stage}-Cluster`, {
      vpc: vpc,
    });

    /**
     * Task Definition
     */
    const fargateTaskDefinition = new FargateTaskDefinition(
      this,
      `DefaultTaskDef`,
      {
        memoryLimitMiB: 512,
        cpu: 256,
      },
    );

    /**
     * Repo
     */
    const ecrRepo = Repository.fromRepositoryName(
      this,
      `${prefix}-${stage}-Default-Repo`,
      `aws-cdk-laravel-with-ecs-dev`,
    );

    const container = fargateTaskDefinition.addContainer(
      `${prefix}-${stage}-Default-Container`,
      {
        image: ContainerImage.fromEcrRepository(ecrRepo),
        memoryLimitMiB: 512,
        cpu: 256,
      },
    );

    container.addPortMappings({
      containerPort: 80,
      protocol: Protocol.TCP,
    });

    /**
     * ECS Service
     */
    const ecsService = new FargateService(
      this,
      `${prefix}-${stage}-Default-Service`,
      {
        cluster: ecsCluster,
        taskDefinition: fargateTaskDefinition,
        desiredCount: 2,
      },
    );

    //---------------------------------------------------------------------------
    /**
     * ALB
     */
    const alb = new ApplicationLoadBalancer(this, `${prefix}-${stage}-ALB`, {
      vpc,
      internetFacing: true,
    });

    const listener = alb.addListener(`${prefix}-${stage}-Listener`, {
      port: 80,
      open: true,
    });

    /**
     * Connect ecsService to TargetGroup
     */
    const targetGroup = listener.addTargets(`${prefix}-${stage}-Target-Group`, {
      port: 80,
      targets: [ecsService],
    });

    new CfnOutput(this, `${prefix}-${stage}-Alb-Dns-Name`, {
      exportName: `${prefix}-${stage}-Alb-Dns-Name`,
      value: alb.loadBalancerDnsName,
    });

    //---------------------------------------------------------------------------
    /**
     * ecsService: Application Auto Scaling
     */
    const scaling = ecsService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization(`${prefix}-${stage}-CpuScaling`, {
      targetUtilizationPercent: 50,
    });

    scaling.scaleOnRequestCount(`${prefix}-${stage}RequestScaling`, {
      requestsPerTarget: 30,
      targetGroup: targetGroup,
    });
  }
}
