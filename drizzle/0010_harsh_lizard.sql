CREATE TABLE "public_order_rate_limits" (
	"ip" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" bigint NOT NULL
);
