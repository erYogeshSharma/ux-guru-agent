import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Session } from "./Session";

@Entity("session_errors")
export class SessionError {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  sessionId!: string;

  @Column({ type: "jsonb" })
  errorData!: any;

  @CreateDateColumn()
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Session, (session) => session.errors, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "sessionId" })
  session!: Session;
}
