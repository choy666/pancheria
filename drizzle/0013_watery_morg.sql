CREATE TYPE "public"."order_message_sender" AS ENUM('client', 'operator');--> statement-breakpoint
CREATE TABLE "order_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sender_type" "order_message_sender" NOT NULL,
	"sender_name" varchar(255),
	"content" text,
	"attachment_url" text,
	"attachment_mime_type" varchar(100),
	"attachment_size" integer,
	"attachment_name" varchar(255),
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_messages_order_id_idx" ON "order_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_messages_order_created_at_idx" ON "order_messages" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_messages_order_sender_read_at_idx" ON "order_messages" USING btree ("order_id","sender_type","read_at");