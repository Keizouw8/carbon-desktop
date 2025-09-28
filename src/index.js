const { dialog, app, BrowserWindow, ipcMain } = require("electron");
const { io } = require("socket.io-client");
const path = require("node:path");
const fs = require("node:fs");
const tar = require("tar");
const si = require("systeminformation");
const prompt = require("custom-electron-prompt");
const { spawn, execFile } = require("child_process");

const distributed = require("./distributed.js").default;

if (require("electron-squirrel-startup")) app.quit();

app.whenReady().then(async () => {
	let socket;

	let mainWindow;

	let stats = { CPU: 100, GPU: 100, power: 0 };
	let diff;
	let powerHistory = [];
	let mWsSavings = 0;
	let distributedMode = false;

	let tempPath = path.join(app.getPath("temp"), "carbon");
	let stagePath = path.join(path.join(tempPath, "stage"));
	let queuePath = path.join(path.join(tempPath, "queue"));
	if(!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
	if(!fs.existsSync(stagePath)) fs.mkdirSync(stagePath);
	if(!fs.existsSync(queuePath)) fs.mkdirSync(queuePath);

	ipcMain.handle("stage", async function(){
		const { filePaths } = await dialog.showOpenDialog({ properties: ["openDirectory"] });
		if (filePaths.length != 1) return { success: false, payload: "Directory cancelled" };

		let folder = filePaths[0];

		if (!fs.existsSync(path.join(folder, "run.sh"))) return { success: false, payload: "No run.sh in directory" };

		fs.renameSync(folder, path.join(path.dirname(folder), "carbon-payload"));
		tar.create({ C: path.dirname(folder), z: true }, ["carbon-payload"]).pipe(fs.createWriteStream(path.join(stagePath, "carbon-payload.tar.gz"))).on("finish", function () {
			fs.renameSync(path.join(path.dirname(folder), "carbon-payload"), folder);
		});

		return { success: true, payload: path.basename(folder) };
	});

	ipcMain.handle("distributedMode", () => {
		distributedMode = !distributedMode;
	});

	ipcMain.handle("queue", () => {
		let file = fs.readFileSync(path.join(stagePath, "carbon-payload.tar.gz"));
		socket.emit("queue", file, diff, distributedMode);
	});

	ipcMain.handle("benchmark", async function () {
		let baselinePower = powerHistory.reduce((a, b) => a+b, 0)/powerHistory.length;

		await tar.extract({ cwd: stagePath, f: path.join(stagePath, "carbon-payload.tar.gz") });

		execFile(path.join(stagePath, "carbon-payload/run.sh"), {
			cwd: path.join(stagePath, "carbon-payload"),
			timeout: 20000
		});

		diff = await (new Promise(function (resolve, reject){
			let child = spawn("sudo", ["-S", "sh", "-c", "powermetrics --samplers cpu_power -i20000 -n1"]);
			// let child = spawn("sudo", ["-S", "sh", "-c", "powermetrics --samplers cpu_power -i2000 -n1"]);
			child.stdin.write(`${password}\n`);

			child.stdout.on("data", async function(buf){
				let data = buf.toString().split("\n").filter(line => line.includes("Combined Power"));
				if (!data.length) return;
				let power = parseInt(data[0].replaceAll(" ", "").replace("CombinedPower(CPU+GPU+ANE):", "").replace("mW", ""));
				resolve(power - baselinePower);
			});
		}));

		return diff;
	});

	app.on("activate", () => {
		if(BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
	});

	mainWindow = createWindow();

	let [password, serverURL] = await prompt({
		title: "(1 MESSAGE) From: Nigerian Prince",
		label: "Carbon",
		type: "multiInput",
		multiInputOptions: [
			{ inputAttrs: { placeholder: "Computer Password", type: "password" } },
			{ inputAttrs: { placeholder: "Server URL", type: "url" } }
		]
	});

	socket = io(serverURL);

	socket.on("queue", function (queue) {
		mainWindow.webContents.send("queue", queue);
	});

	socket.on("result", async function (file, mWsSaved) {
		mWsSavings += mWsSaved;
		mainWindow.webContents.send("savings", mWsSavings);
		mainWindow.webContents.send("resetUpload");
		fs.writeFile(path.join(app.getPath("downloads"), "carbon-payload.tar.gz"), file, () => { });
	});

	socket.on("execute", async function ([sid, file, mW, isAI]){
		const start = Date.now();

		fs.writeFileSync(path.join(queuePath, "carbon-payload.tar.gz"), file);
		await tar.extract({ cwd: queuePath, f: path.join(queuePath, "carbon-payload.tar.gz") });

		let baselinePower = powerHistory.reduce((a, b) => a+b, 0) / powerHistory.length;

		await new Promise(function (resolve) {
			let output = "$ ./run.sh";
			mainWindow.webContents.send("terminal", output);
			let child = spawn("./run.sh", { env: { PYTHONUNBUFFERED: "1" }, shell: true, cwd: path.join(queuePath, "carbon-payload") });
			child.stdout.on("data", function(data){
				output += "\n" + data;
				mainWindow.webContents.send("terminal", output);
			});
			child.stdout.on("close", resolve);
		});

		await new Promise(resolve =>
			tar.create({ C: queuePath, z: true }, ["carbon-payload"])
				.pipe(fs.createWriteStream(path.join(queuePath, "carbon-payload.tar.gz")))
				.on("finish", resolve));

		let resultantPower = powerHistory.reduce((a, b) => a+b, 0)/powerHistory.length;

		const end = Date.now();

		fs.readFile(path.join(queuePath, "carbon-payload.tar.gz"), function (err, data) {
			if (err) return console.error(err);
			socket.emit("completed", data, resultantPower - baselinePower, (start - end) / 1000, function (savings) {
				mWsSavings += savings;
				mainWindow.webContents.send("savings", mWsSavings);
			});
		});
	});

	socket.on("AI execute", async function (file, index, numAgents, loadPercentage){
		console.log("temp path: ", tempPath);

		const start = Date.now();

		console.log("receiving payload...");

		fs.writeFileSync(path.join(queuePath, "carbon-payload.tar.gz"), file);
		await tar.extract({ cwd: queuePath, f: path.join(queuePath, "carbon-payload.tar.gz") });

		console.log("received payload!");

		let baselinePower = powerHistory.reduce((a, b) => a+b, 0) / powerHistory.length;

		let pyFile = distributed.replace("∅_1", index).replace("∅_2", numAgents);

		fs.writeFileSync(path.join(queuePath, "carbon-payload/carbon-naught.py"), pyFile);

		execFile("/usr/bin/python3 carbon-naught.py", { cwd: path.join(queuePath, "carbon-payload") }, function (error, stdout, stderr){
			console.log("finished running carbon-naught.py");
			if (error) console.error(error);
			if (stderr) console.error(stderr);
			if (stdout) console.log(stdout);
			let resultantPower = powerHistory.reduce((a, b) => a+b, 0)/powerHistory.length;

			const end = Date.now();

			fs.readFile(path.join(queuePath, "carbon-payload/model.pth"), function (err, data) {
				if (err) return console.error(err);
				socket.emit("completed", data, resultantPower - baselinePower, (start - end) / 1000, function (savings) {
					mWsSavings += savings;
					mainWindow.webContents.send("savings", mWsSavings);
				});
			});
		});

	});

	let child = spawn("sudo", ["-S", "sh", "-c", "powermetrics --samplers gpu_power,cpu_power -i2000"]);
	child.stdin.write(`${password}\n`);
	child.stdout.on("data", async function(buf){
		let data = buf.toString().split("\n").filter(line => line.includes("Combined Power") || line.includes("GPU HW active residency"));
		if (data.length < 2) return;

		let power = parseInt(data[0].replaceAll(" ", "").replace("CombinedPower(CPU+GPU+ANE):", "").replace("mW", ""));
		let GPU = parseFloat(data[1].split("%")[0].replaceAll(" ","").replace("GPUHWactiveresidency:", ""));
		let CPU = (await si.currentLoad()).currentLoad;
		stats = { CPU, GPU, power };
		powerHistory.push(power);
		if(powerHistory.length > 10) powerHistory.shift();
		socket.emit("available", Math.min(GPU, CPU) < 50, GPU);
		mainWindow.webContents.send("stats", stats);
	});
	child.stderr.on("data", buf => console.log(buf.toString()));
});

function createWindow(){
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 480,
		minHeight: 110,
		webPreferences: { preload: path.join(__dirname, "preload.js") }
	});

	mainWindow.loadFile(path.join(__dirname, "index.html"));

	return mainWindow;
}
