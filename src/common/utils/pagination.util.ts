export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PaginationUtil {
  static createPagination<T>(items: T[], options: PaginationOptions = {}): PaginationResult<T> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedItems = items.slice(startIndex, endIndex);

    return {
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  static getSkipAndTake(page?: number, limit?: number): { skip?: number; take?: number } {
    const parsedPage = page ?? 1;
    const parsedLimit = limit ?? 10;

    return {
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    };
  }
}
