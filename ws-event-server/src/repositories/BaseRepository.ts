import {
  Repository,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  DeepPartial,
} from "typeorm";
import AppDataSource from "@/config/data-source";

export abstract class BaseRepository<T extends ObjectLiteral> {
  protected repository: Repository<T>;

  constructor(entity: EntityTarget<T>) {
    this.repository = AppDataSource.getRepository(entity);
  }

  async findById(id: string): Promise<T | null> {
    return await this.repository.findOne({
      where: { id } as any,
    } as FindOneOptions<T>);
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    await this.repository.update(id, updates as any);
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected || 0) > 0;
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    return await this.repository.count(options);
  }
}
