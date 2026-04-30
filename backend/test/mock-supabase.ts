type QueryResult = { data?: unknown; error?: { message: string } | null; count?: number }

class QueryBuilder implements PromiseLike<QueryResult> {
  calls: Array<{ method: string; args: unknown[] }> = []

  constructor(private result: QueryResult = { data: [], error: null }) {}

  select(...args: unknown[]) { this.calls.push({ method: 'select', args }); return this }
  eq(...args: unknown[]) { this.calls.push({ method: 'eq', args }); return this }
  order(...args: unknown[]) { this.calls.push({ method: 'order', args }); return this }
  insert(...args: unknown[]) { this.calls.push({ method: 'insert', args }); return this }
  update(...args: unknown[]) { this.calls.push({ method: 'update', args }); return this }
  delete(...args: unknown[]) { this.calls.push({ method: 'delete', args }); return this }

  single(): Promise<QueryResult> {
    this.calls.push({ method: 'single', args: [] })
    return Promise.resolve(this.result)
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

export function createMockSupabase(results: QueryResult[]) {
  const builders: QueryBuilder[] = []
  const tableCalls: string[] = []

  return {
    builders,
    tableCalls,
    client: {
      from(table: string) {
        tableCalls.push(table)
        const builder = new QueryBuilder(results.shift() ?? { data: [], error: null })
        builders.push(builder)
        return builder
      },
    },
  }
}
