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
        const columnsMatch = this.sql.match(/\((.*?)\)\s+VALUES/i)
        const columns = columnsMatch ? columnsMatch[1].split(',').map((c) => c.trim()) : []

        // Create row with params mapped to columns
        const row: MockRow = {}
        columns.forEach((col, index) => {
          row[col] = params[index]
        })

        this.db.addRow(tableName, row)
      }
      return { changes: 1, lastInsertRowid: Date.now() }
    } else if (sqlLower.includes('update')) {
      return { changes: 1, lastInsertRowid: 0 }
    } else if (sqlLower.includes('delete')) {
      const tableName = this.extractTableName(sqlLower, 'delete')
      if (tableName) {
        const beforeCount = this.db.getTableData(tableName).length
        this.db.clearTable(tableName)
        return { changes: beforeCount, lastInsertRowid: 0 }
      }
      return { changes: 0, lastInsertRowid: 0 }
    }

    return { changes: 0, lastInsertRowid: 0 }
  }

  get(...params: any[]): MockRow | undefined {
    // Return first row or undefined
    const sqlLower = this.sql.toLowerCase()
    const tableName = this.extractTableName(sqlLower, 'select')

    if (tableName) {
      const data = this.db.getTableData(tableName)
      return data.length > 0 ? data[0] : undefined
    }

    return undefined
  }

  all(...params: any[]): MockRow[] {
    // Return all rows
    const sqlLower = this.sql.toLowerCase()
    const tableName = this.extractTableName(sqlLower, 'select')

    if (tableName) {
      return this.db.getTableData(tableName)
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
  private pragmaSettings = {
    journal_mode: 'delete',
    foreign_keys: 0
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
