import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

type DrizzleInstance = ReturnType<typeof drizzle>

export class DrizzleConnection {
  private constructor() {
    throw new Error(`DrizzleConnection is a singleton and shouldn't be instanciated`)
  }

  static #databaseUrl: string
  static #instance: DrizzleInstance

  public static migrationsFolder = './src/db/migrations'
  public static schemasFile = './src/db/schemas/index.ts'

  public static get databaseUrl() {
    if (!DrizzleConnection.#databaseUrl) {
      throw new Error('DrizzleInstance.databaseUrl is empty')
    }

    return DrizzleConnection.#databaseUrl
  }

  public static set databaseUrl(databaseUrl: string) {
    if (DrizzleConnection.#instance && !DrizzleConnection.#instance.$client.closed) {
      DrizzleConnection.#instance.$client.close()
    }

    DrizzleConnection.#databaseUrl = databaseUrl
  }

  public static get instance() {
    const databaseUrl = DrizzleConnection.databaseUrl

    if (!DrizzleConnection.#instance || DrizzleConnection.#instance.$client.closed) {
      DrizzleConnection.#instance = drizzle({
        connection: databaseUrl
      })
    }

    return DrizzleConnection.#instance
  }

  private static set instance(_instance: DrizzleInstance) {
    throw new Error(`DrizzleConnection.instance is a singleton and shouldn't be changed`)
  }

  public static async runMigrations() {
    await migrate(DrizzleConnection.instance, {
      migrationsFolder: DrizzleConnection.migrationsFolder,
      migrationsSchema: DrizzleConnection.schemasFile
    })
  }
}
