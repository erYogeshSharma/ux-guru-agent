import "reflect-metadata";
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Organization } from "./Organization";
import { SessionEvent } from "./SessionEvent";
import { SessionError } from "./SessionError";

@Entity("sessions")
export class Session {
  @PrimaryColumn({ type: "varchar", length: 255 })
  id!: string; // sessionId

  @Column({ type: "varchar", length: 255 })
  userId!: string;

  @Column({ type: "jsonb" })
  metadata!: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    startTime: number;
    lastActivity: number;
    referrer: string;
    timeZone: string;
    [key: string]: any;
  };

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "integer", default: 0 })
  eventCount!: number;

  @Column({ type: "integer", default: 0 })
  errorCount!: number;

  @Column({ type: "timestamp", nullable: true })
  endedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Foreign Key
  @Column({ type: "uuid" })
  organizationId!: string;

  // Relations
  @ManyToOne(() => Organization, (organization) => organization.sessions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organizationId" })
  organization!: Organization;

  @OneToMany(() => SessionEvent, (event: SessionEvent) => event.session, {
    cascade: true,
  })
  events!: SessionEvent[];

  @OneToMany(() => SessionError, (error: SessionError) => error.session, {
    cascade: true,
  })
  errors!: SessionError[];
}
