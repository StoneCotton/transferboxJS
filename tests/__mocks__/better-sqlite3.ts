/**
 * Mock for better-sqlite3
 * Used in tests to simulate SQLite database operations
 */

interface MockRow {
  [key: string]: any
}

class MockStatement {
  private sql: string
  private db: MockDatabase

  constructor(sql: string, db: MockDatabase) {
    this.sql = sql
    this.db = db
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    // Simulate INSERT/UPDATE/DELETE
    const sqlLower = this.sql.toLowerCase()

    if (sqlLower.includes('insert')) {
      // Add to table data
      const tableName = this.extractTableName(sqlLower, 'insert')
      if (tableName) {
        // Extract column names from INSERT statement
        // Handle multiline and complex formatting
        const columnsMatch = this.sql.match(/INSERT\s+INTO\s+\w+\s*\(([\s\S]*?)\)\s+VALUES/i)
        const columns = columnsMatch
          ? columnsMatch[1].split(',').map((c) => c.trim().replace(/\s+/g, ' '))
          : []

        // Create row with params mapped to columns
        const row: MockRow = {}
        columns.forEach((col, index) => {
          if (params[index] !== undefined) {
            row[col] = params[index]
          }
        })

        this.db.addRow(tableName, row)
      }
      return { changes: 1, lastInsertRowid: Date.now() }
    } else if (sqlLower.includes('update')) {
      const tableName = this.extractTableName(sqlLower, 'update')
      if (tableName) {
        // Simple UPDATE simulation - update first row that matches WHERE
        const data = this.db.getTableData(tableName)
        if (data.length > 0) {
          // Parse SET clause
          const setMatch = this.sql.match(/SET\s+([\s\S]+?)(?:WHERE|$)/i)
          if (setMatch) {
            const setPairs = setMatch[1].split(',')
            let paramIndex = 0

            setPairs.forEach((pair) => {
              const [col] = pair.split('=').map((s) => s.trim())
              if (col && params[paramIndex] !== undefined) {
                data[0][col] = params[paramIndex]
                paramIndex++
              }
            })
          }
        }
      }
      return { changes: 1, lastInsertRowid: 0 }
    } else if (sqlLower.includes('delete')) {
      const tableName = this.extractTableName(sqlLower, 'delete')
      if (tableName) {
        const data = this.db.getTableData(tableName)
        const beforeCount = data.length

        // Handle WHERE clause for conditional deletes
        if (sqlLower.includes('where') && params.length > 0) {
          // Handle comparisons like "WHERE start_time < ?"
          const whereMatch = this.sql.match(/where\s+(\w+)\s*(<|>|=)\s*\?/i)
          if (whereMatch) {
            const columnName = whereMatch[1]
            const operator = whereMatch[2]
            const compareValue = params[0]

            // Filter and keep only rows that DON'T match the delete condition
            const kept = data.filter((row) => {
              const value = row[columnName]
              switch (operator) {
                case '<':
                  return !(value < compareValue)
                case '>':
                  return !(value > compareValue)
                case '=':
                  return !(value === compareValue)
                default:
                  return true
              }
            })

            this.db._setMockData(tableName, kept)
            return { changes: beforeCount - kept.length, lastInsertRowid: 0 }
          }
        }

        // No WHERE clause - delete all
        this.db.clearTable(tableName)
        return { changes: beforeCount, lastInsertRowid: 0 }
      }
      return { changes: 0, lastInsertRowid: 0 }
    }

    return { changes: 0, lastInsertRowid: 0 }
  }

  get(...params: any[]): MockRow | undefined {
    // Return first row matching WHERE clause or undefined
    const sqlLower = this.sql.toLowerCase()
    const tableName = this.extractTableName(sqlLower, 'select')

    if (tableName) {
      const data = this.db.getTableData(tableName)

      // Handle WHERE clause if present
      if (sqlLower.includes('where') && params.length > 0) {
        // Extract column name from WHERE clause (e.g., "WHERE id = ?" -> "id")
        const whereMatch = this.sql.match(/where\s+(\w+)\s*=\s*\?/i)
        if (whereMatch) {
          const columnName = whereMatch[1]
          const searchValue = params[0]

          // Find matching row
          const found = data.find((row) => row[columnName] === searchValue)
          return found
        }
      }

      // Return first row if no WHERE clause
      return data.length > 0 ? data[0] : undefined
    }

    return undefined
  }

  all(...params: any[]): MockRow[] {
    // Return all rows matching WHERE clause
    const sqlLower = this.sql.toLowerCase()
    const tableName = this.extractTableName(sqlLower, 'select')

    if (tableName) {
      let data = this.db.getTableData(tableName)
      let paramIndex = 0

      // Handle WHERE clause if present
      if (sqlLower.includes('where')) {
        // Handle date range queries first (WHERE timestamp >= ? AND timestamp <= ?)
        const rangeMatch = this.sql.match(/where\s+(\w+)\s*>=\s*\?\s+and\s+\1\s*<=\s*\?/i)
        if (
          rangeMatch &&
          params[paramIndex] !== undefined &&
          params[paramIndex + 1] !== undefined
        ) {
          const columnName = rangeMatch[1]
          const startValue = params[paramIndex]
          const endValue = params[paramIndex + 1]
          data = data.filter((row) => row[columnName] >= startValue && row[columnName] <= endValue)
          paramIndex += 2
        } else {
          // Handle multiple WHERE conditions with AND
          const whereConditions = this.sql.match(/where\s+([\s\S]+?)(?:order by|limit|$)/i)
          if (whereConditions) {
            const conditions = whereConditions[1].split(/\s+and\s+/i)

            conditions.forEach((condition) => {
              const condMatch = condition.match(/(\w+)\s*=\s*\?/)
              if (condMatch && params[paramIndex] !== undefined) {
                const columnName = condMatch[1]
                const searchValue = params[paramIndex]
                data = data.filter((row) => row[columnName] === searchValue)
                paramIndex++
              }
            })
          }
        }
      }

      // Handle ORDER BY DESC (most recent first)
      if (sqlLower.includes('order by') && sqlLower.includes('desc')) {
        const orderMatch = this.sql.match(/order\s+by\s+(\w+)\s+desc/i)
        if (orderMatch) {
          const columnName = orderMatch[1]
          data = [...data].sort((a, b) => {
            const aVal = a[columnName] || 0
            const bVal = b[columnName] || 0
            // If values are equal, use insertion order (higher insertion order = more recent)
            if (aVal === bVal) {
              return (b._insertionOrder || 0) - (a._insertionOrder || 0)
            }
            return bVal - aVal // DESC order
          })
        }
      }

      // Handle LIMIT - the limit param is after WHERE params
      if (sqlLower.includes('limit')) {
        const limitValue = params[paramIndex]
        if (typeof limitValue === 'number' && limitValue > 0) {
          data = data.slice(0, limitValue)
        }
      }

      return data
    }

    return []
  }

  private extractTableName(sql: string, operation: string): string | null {
    const patterns: Record<string, RegExp> = {
      insert: /insert\s+into\s+(\w+)/i,
      select: /from\s+(\w+)/i,
      update: /update\s+(\w+)/i,
      delete: /delete\s+from\s+(\w+)/i
    }

    const match = sql.match(patterns[operation])
    return match ? match[1] : null
  }
}

class MockDatabase {
  private tables = new Map<string, MockRow[]>()
  private isOpen = true
  private insertionCounter = 0 // Track insertion order
  private pragmaSettings = {
    journal_mode: 'WAL', // Default to WAL mode
    foreign_keys: 1 // Default foreign keys enabled
  }

  constructor(filename: string, options?: any) {
    // Mock constructor
  }

  prepare(sql: string): MockStatement {
    return new MockStatement(sql, this)
  }

  exec(sql: string): this {
    // Execute SQL (for schema creation, etc.)
    const sqlLower = sql.toLowerCase()

    // Detect CREATE TABLE statements
    const createTableMatch = sqlLower.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/g)
    if (createTableMatch) {
      createTableMatch.forEach((match) => {
        const tableMatch = match.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/)
        if (tableMatch) {
          const tableName = tableMatch[1]
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, [])
          }
        }
      })
    }

    return this
  }

  close(): void {
    this.isOpen = false
  }

  pragma(pragma: string, options?: any): any {
    const pragmaLower = pragma.toLowerCase()

    if (pragmaLower.includes('journal_mode')) {
      if (pragmaLower.includes('=')) {
        const mode = pragma.split('=')[1].trim()
        this.pragmaSettings.journal_mode = mode
        return mode
      }
      if (options?.simple) {
        return this.pragmaSettings.journal_mode
      }
      return this.pragmaSettings.journal_mode
    }

    if (pragmaLower.includes('foreign_keys')) {
      if (pragmaLower.includes('=')) {
        const value = pragma.split('=')[1].trim().toUpperCase()
        this.pragmaSettings.foreign_keys = value === 'ON' ? 1 : 0
        return this.pragmaSettings.foreign_keys
      }
      if (options?.simple) {
        return this.pragmaSettings.foreign_keys
      }
      return this.pragmaSettings.foreign_keys
    }

    return null
  }

  // Helper methods for internal use
  addRow(tableName: string, row: MockRow): void {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, [])
    }
    // Add insertion order for sorting stability
    row._insertionOrder = this.insertionCounter++
    this.tables.get(tableName)!.push(row)
  }

  getTableData(tableName: string): MockRow[] {
    return this.tables.get(tableName) || []
  }

  clearTable(tableName: string): void {
    if (this.tables.has(tableName)) {
      this.tables.set(tableName, [])
    }
  }

  getTableNames(): string[] {
    return Array.from(this.tables.keys())
  }

  // Helper for tests to inject mock data
  _setMockData(tableName: string, data: MockRow[]): void {
    this.tables.set(tableName, data)
  }

  // Helper to check if DB is open
  _isOpen(): boolean {
    return this.isOpen
  }
}

// Export as both default and named for compatibility
export = MockDatabase
