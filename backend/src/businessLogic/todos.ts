import 'source-map-support/register'

import { APIGatewayProxyEvent } from 'aws-lambda'
import * as AWS from 'aws-sdk'
import * as uuid from 'uuid'

import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { createLogger } from '../utils/logger'

const logger = createLogger('todos')

const docClient = new AWS.DynamoDB.DocumentClient()

const s3 = new AWS.S3({
  signatureVersion: 'v4'
})

const todosTable = process.env.TODOS_TABLE
const indexName = process.env.USERID_CREATEDAT_INDEX
const bucketName = process.env.ATTACHMENTS_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

export async function getTodos(userId: string): Promise<TodoItem[]> {
  logger.info(`Retrieving all todos for user ${userId}`, { userId })

  const result = await docClient.query({
    TableName: todosTable,
    IndexName: indexName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }).promise()

  const items = result.Items

  return items as TodoItem[]
}

export async function createTodo(userId: string, createTodoRequest: CreateTodoRequest): Promise<TodoItem> {
  const todoId = uuid.v4()

  const newItem: TodoItem = {
    userId,
    todoId,
    createdAt: new Date().toISOString(),
    done: false,
    attachmentUrl: null,
    ...createTodoRequest
  }

  logger.info(`Creating todo ${todoId} for user ${userId}`, { userId, todoId, todoItem: newItem })

  await docClient.put({
    TableName: todosTable,
    Item: newItem,
  }).promise()

  return newItem
}

export async function updateTodo(userId: string, todoId: string, updateTodoRequest: UpdateTodoRequest) {
  logger.info(`Updating todo ${todoId} for user ${userId}`, { userId, todoId, updateTodoRequest })

  await docClient.update({
    TableName: todosTable,
    Key: {
      userId,
      todoId
    },
    UpdateExpression: 'set #name = :name, dueDate = :dueDate, done = :done',
    ExpressionAttributeNames: {
      "#name": "name"
    },
    ExpressionAttributeValues: {
      ":name": updateTodoRequest.name,
      ":dueDate": updateTodoRequest.dueDate,
      ":done": updateTodoRequest.done
    }
  }).promise()
}

export async function deleteTodo(userId: string, todoId: string) {
  logger.info(`Deleting todo ${todoId} for user ${userId}`, { userId, todoId })

  await docClient.delete({
    TableName: todosTable,
    Key: {
      userId,
      todoId
    }
  }).promise()
}

export async function updateAttachmentUrl(userId: string, todoId: string, attachmentId: string) {
  const attachmentUrl = `https://${bucketName}.s3.amazonaws.com/${attachmentId}`

  logger.info(`Updating todo ${todoId} with attachment URL ${attachmentUrl}`, { userId, todoId })

  await docClient.update({
    TableName: todosTable,
    Key: {
      userId,
      todoId
    },
    UpdateExpression: 'set attachmentUrl = :attachmentUrl',
    ExpressionAttributeValues: {
      ':attachmentUrl': attachmentUrl
    }
  }).promise();
}

export async function generateUploadUrl(attachmentId: string): Promise<string> {
  logger.info(`Generating upload URL for attachment ${attachmentId}`)

  const uploadUrl = s3.getSignedUrl('putObject', {
    Bucket: bucketName,
    Key: attachmentId,
    Expires: urlExpiration
  })

  return uploadUrl
}
