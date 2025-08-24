import {
  EntityTarget,
  FindManyOptions,
  FindOptionsWhere,
  FindOptionsOrder,
  FindOptionsSelect,
  FindOptionsRelations,
  ObjectLiteral,
} from "typeorm";

import dataSource from "@/config/data-source";
export type OrderDirection = "ASC" | "DESC";

export interface PaginateOptions<T extends ObjectLiteral> {
  page?: number;
  limit?: number;
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  order?: FindOptionsOrder<T>;
  relations?: FindOptionsRelations<T> | string[];
  select?: FindOptionsSelect<T> | (keyof T)[];
  maxLimit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export async function paginate<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  opts: PaginateOptions<T> = {}
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    limit = 10,
    where,
    order,
    relations,
    select,
    maxLimit = 100,
  } = opts;

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), maxLimit);
  const safePage = Math.max(1, Math.floor(page));
  const skip = (safePage - 1) * safeLimit;

  // NOTE: getRepository is deprecated in TypeORM 0.3.x (still works).
  // To avoid the deprecation, use your DataSource instance:
  // import { AppDataSource } from "../data-source";
  // const repo = AppDataSource.getRepository<T>(entity);
  const repo = dataSource.getRepository<T>(entity);

  const findOptions: FindManyOptions<T> = {
    where,
    skip,
    take: safeLimit,
    order,
    relations: relations as any,
    select: select as FindOptionsSelect<T> | (keyof T)[],
  };

  const [data, total] = await repo.findAndCount(findOptions);

  const pageCount = total === 0 ? 0 : Math.ceil(total / safeLimit);

  return {
    data,
    total,
    page: safePage,
    limit: safeLimit,
    pageCount,
  };
}

export default paginate;
