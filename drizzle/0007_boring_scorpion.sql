CREATE TABLE "login_attempts" (
	"username" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"last_attempt" bigint NOT NULL
);
