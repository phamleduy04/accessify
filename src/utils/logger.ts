import chalk from "chalk";

export function logWithTimestamp(
	level: "log" | "error" | "warn" | "info",
	...args: unknown[]
) {
	const timestamp = `[${new Date().toUTCString()}]`;
	let coloredLevel: string;
	if (level === "error") {
		coloredLevel = chalk.red.bold("[ERROR]");
	} else if (level === "warn") {
		coloredLevel = chalk.yellow.bold("[WARN]");
	} else if (level === "info") {
		coloredLevel = chalk.blue.bold("[INFO]");
	} else {
		coloredLevel = chalk.green.bold("[LOG]");
	}
	// Print with colorized level and timestamp
	(console[level] as (...args: unknown[]) => void)(
		`${coloredLevel} ${chalk.gray(timestamp)}`,
		...args,
	);
}

export function contextLogWithUndefined(
	context: string,
	err: unknown,
): undefined {
	logWithTimestamp("error", context, err);
	return undefined;
}
