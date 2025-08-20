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

@Entity("session_events")
export class SessionEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  sessionId!: string;

  @Column({ type: "jsonb" })
  events!: any[];

  @Column({ type: "integer" })
  eventCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Session, (session) => session.events, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "sessionId" })
  session!: Session;
}
