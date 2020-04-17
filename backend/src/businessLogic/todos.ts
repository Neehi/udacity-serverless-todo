import 'source-map-support/register'

import { APIGatewayProxyEvent } from 'aws-lambda'
import * as AWS from 'aws-sdk'
import * as uuid from 'uuid'

import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'

const docClient = new AWS.DynamoDB.DocumentClient()

const s3 = new AWS.S3({
  signatureVersion: 'v4'
})

const todosTable = process.env.TODOS_TABLE
const indexName = process.env.USERID_CREATEDAT_INDEX
const bucketName = process.env.ATTACHMENTS_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

export async function getTodos(userId: string): Promise<TodoItem[]> {
  console.log(`Retrieving all todos for user ${userId}`)

  const result = await docClient.query({
    TableName: todosTable,
    IndexName: indexName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }).promise()

  const items = result.Items

  console.log(`Retrieved ${items.length} todos`)

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

  console.log(`Creating todo ${todoId} for user ${userId} - ${JSON.stringify(newItem)}`)

  await docClient.put({
    TableName: todosTable,
    Item: newItem,
  }).promise()

  console.log(`Created todo ${todoId}`)

  return newItem
}

export async function updateTodo(userId: string, todoId: string, updateTodoRequest: UpdateTodoRequest) {
  console.log(`Updating todo ${todoId} for user ${userId} - ${JSON.stringify(updateTodoRequest)}`)

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

  console.log(`Updated todo ${todoId}`)
}

export async function deleteTodo(userId: string, todoId: string) {
  console.log(`Deleting todo ${todoId} for user ${userId}`)

  await docClient.delete({
    TableName: todosTable,
    Key: {
      userId,
      todoId
    }
  }).promise()

  console.log(`Deleted todo ${todoId}`)
}

export async function updateAttachmentUrl(userId: string, todoId: string, attachmentId: string) {
  const attachmentUrl = `https://${bucketName}.s3.amazonaws.com/${attachmentId}`

  console.log(`Updating todo ${todoId} with attachment URL ${attachmentUrl}`)

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

  console.log(`Updated todo ${todoId}`)
}

export async function generateUploadUrl(attachmentId: string): Promise<string> {
  console.log(`Generating upload URL for attachment ${attachmentId}`)

  const uploadUrl = s3.getSignedUrl('putObject', {
    Bucket: bucketName,
    Key: attachmentId,
    Expires: urlExpiration
  })

  console.log(`Generated upload URL ${uploadUrl}`)

  return uploadUrl
}
