import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastActionParams } from "./forecast_types"

interface ForecastDataImportParams extends ForecastActionParams {
  forecastService: ForecastService
  s3ObjectKey: string
}

export default class ForecastDataImport {
  datasetGroupArn: string | undefined
  private datasetImportJobArn: string | undefined
  private forecastService: ForecastService
  private s3ObjectKey: string
  private bucketName: string
  private datasetName: string
  private datasetGroupName: string
  private forecastingDomain: string
  private dataFrequency: string
  private roleArn: string
  private datasetArn: string | undefined

  constructor(params: ForecastDataImportParams) {
    this.forecastService = params.forecastService
    this.s3ObjectKey = params.s3ObjectKey
    this.bucketName = params.bucketName
    this.datasetName = params.datasetName
    this.datasetGroupName = params.datasetGroupName
    this.forecastingDomain = params.forecastingDomain
    this.dataFrequency = params.dataFrequency
    this.roleArn = params.roleArn
    this.checkResourceCreationComplete = this.checkResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createDataset()
    await this.createDatasetGroup()
    await this.createDatasetImportJob()
  }

  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  async checkResourceCreationComplete() {
    if (!this.datasetImportJobArn) {
      return false
    }
    const { Status } = await this.forecastService.describeDatasetImportJob({
      DatasetImportJobArn: this.datasetImportJobArn,
    }).promise()
    winston.debug("describeDatasetImportJob polling complete: ", Status === "ACTIVE")
    return Status === "ACTIVE"
  }

  private async createDataset() {
    const params = {
      DatasetName: this.datasetName,
      DatasetType: "TARGET_TIME_SERIES", // TODO: there are other possible values here, do I need to consider them?
      Domain: this.forecastingDomain,
      Schema: { // TODO: schema hardcoded for now. What's the best way to make this work dynamically?
        Attributes: [
          {
            AttributeName: "timestamp",
            AttributeType: "timestamp",
          },
          {
            AttributeName: "item_id",
            AttributeType: "string",
          },
          {
            AttributeName: "target_value",
            AttributeType: "float",
          },
        ],
      },
      DataFrequency: this.dataFrequency,
    }

    const { DatasetArn } = await this.forecastService.createDataset(params).promise()
    this.datasetArn = DatasetArn
  }

  private async createDatasetGroup() {
    const params = {
      DatasetGroupName: this.datasetGroupName,
      Domain: this.forecastingDomain,
      DatasetArns: [
        this.datasetArn!, // TODO: is there a valid case in which the DatasetArn would be undefined?
      ],
    }

    const { DatasetGroupArn } = await this.forecastService.createDatasetGroup(params).promise()
    this.datasetGroupArn = DatasetGroupArn
  }

  private async createDatasetImportJob() {
    const params = {
      DataSource: {
        S3Config: {
          Path: `s3://${this.bucketName}/${this.s3ObjectKey}`,
          RoleArn: this.roleArn,
        },
      },
      DatasetArn: this.datasetArn!,
      DatasetImportJobName: `${this.datasetName}_import_job`,
      TimestampFormat: "yyyy-MM-dd", // TODO: make this dynamic based on frequency selection
    }

    const {
      DatasetImportJobArn,
    } = await this.forecastService.createDatasetImportJob(params).promise()
    this.datasetImportJobArn = DatasetImportJobArn
  }
}