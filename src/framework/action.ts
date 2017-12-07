import * as fs from "fs"
import * as path from "path"

import {
  ActionForm,
  ActionFormat,
  ActionFormatting,
  ActionRequest,
  ActionResponse,
  ActionType,
  ActionVisualizationFormatting,
} from "."

const datauri = require("datauri")

export interface ActionParameter {
  name: string
  label: string
  required: boolean
  sensitive: boolean
  description?: string
}

export interface RequiredField {
  tag?: string
  any_tag?: string[]
  all_tags?: string[]
}

export interface Action {
  action(request: ActionRequest): Promise<ActionResponse>
  form?(request: ActionRequest): Promise<ActionForm>
}

export interface RouteBuilder {
  actionUrl(action: Action): string
  formUrl(action: Action): string
}

export abstract class Action {

  name: string
  label: string
  description: string
  iconName?: string

  supportedActionTypes: ActionType[]
  supportedFormats?: ActionFormat[]
  supportedFormattings?: ActionFormatting[]
  supportedVisualizationFormattings?: ActionVisualizationFormatting[]
  requiredFields?: RequiredField[] = []

  params: ActionParameter[]

  asJson(router: RouteBuilder) {
    return {
      description: this.description,
      form_url: this.form ? router.formUrl(this) : null,
      label: this.label,
      name: this.name,
      params: this.params,
      required_fields: this.requiredFields,
      supported_action_types: this.supportedActionTypes,
      supported_formats: this.supportedFormats,
      supported_formattings: this.supportedFormattings,
      supported_visualization_formattings: this.supportedVisualizationFormattings,
      icon_data_uri: this.getImageDataUri(),
      url: this.action ? router.actionUrl(this) : null,
    }
  }

  async validateAndPerformAction(request: ActionRequest) {

    if (this.supportedActionTypes &&
      this.supportedActionTypes.indexOf(request.type) === -1
    ) {
       throw `This action does not support requests of type "${request.type}".`
    }

    const requiredParams = this.params.filter((p) => p.required)

    if (requiredParams.length > 0) {
      if (request.params) {
        for (const p of requiredParams) {
          const param = request.params[p.name]
          if (!param) {
            throw `Required parameter "${p.name}" not provided.`
          }
        }
      } else {
        throw `No "params" provided but this action has required parameters.`
      }
    }

    return this.action(request)

  }

  async validateAndFetchForm(request: ActionRequest) {
    return this.form!(request)
  }

  get hasAction() {
    return !!this.action
  }

  get hasForm() {
    return !!this.form
  }

  private getImageDataUri() {
    if (!this.iconName) {
      return null
    }
    const iconPath = path.resolve(__dirname, "..", "actions", this.iconName)
    if (fs.existsSync(iconPath)) {
      return new datauri(iconPath).content
    }
    return null
  }

}
