document.querySelector("div.stage").addEventListener("click", async function(e){
	if(e.currentTarget.classList.contains("queue")){
		window.electron.queue();
		return;
	}
	if(e.currentTarget.classList.contains("benchmark")){
		document.querySelector("div.stage > div.progress").classList.add("active");
		document.querySelector("span.benchmark-label").innerText = "BENCHMARKING...";
		let difference = await window.electron.benchmark();
		document.querySelector("span.benchmark-label").innerText = "Queue";
		document.querySelector("span.filename").innerText += ` | Diff: +${Math.round(difference/100)/10}W`;
		document.querySelector("div.stage").classList.add("queue");
		return;
	}
	e.currentTarget.classList.add("loading");
	let { success, payload } = await window.electron.stage();
	document.querySelector("div.stage").classList.remove("loading");
	document.querySelector("div.stage").classList.remove("benchmark");
	if (!success) return alert(payload);
	document.querySelector("div.stage").classList.add("benchmark");
	document.querySelector("span.filename").innerText = payload;
});

document.querySelector(".optimizations").addEventListener("click", function (e) {
	let optimized = 1 - +e.currentTarget.getAttribute("active");
	e.currentTarget.setAttribute("active", optimized);
	if (optimized) e.currentTarget.innerText = "Enabled AI Runtime Optimizations ✨";
	else e.currentTarget.innerText = "Enable AI Runtime Optimizations";
});

window.electron.onTerminal(function(output){
	var terminal = document.querySelector(".terminal");
	terminal.innerText = output;
	terminal.scrollTop = terminal.scrollHeight;
});

window.electron.onQueue(function(queue){
	document.querySelector(".sidebar .queue").innerHTML = "";
	for(let [sid, isAI] of queue){
		let p = document.createElement("p");
		p.innerText = sid;
		if (isAI) p.innerText += " (AI)";
		document.querySelector(".sidebar .queue").appendChild(p);
	}
});

window.electron.onStats(function({ CPU, GPU, power }){
	document.querySelector(".stats").innerText = `CPU: ${Math.round(CPU)}% GPU: ${Math.round(GPU)}% PWR ${Math.round(power/100)/10}W`;
});

window.electron.onSavings(function(mWs){
	document.querySelector("#co2 em").innerText = parseInt(mWs * 10e-4 / 3.6) / 100;
	document.querySelector("#nyc em").innerText = parseInt(mWs * 10e-10 / 2.16) / 100;
	document.querySelector("#gpt em").innerText = `${parseInt(mWs * 10e-11 / 4.68) / 100}%`;
});

window.electron.onResetUpload(function(){
	document.querySelector("span.benchmark-label").innerText = "BENCHMARK";
	document.querySelector("div.stage > div.progress").classList.remove("active");
	document.querySelector("span.filename").innerText = "";
	document.querySelector("div.stage").className = "stage";
});

document.querySelectorAll(".tabs i").forEach((tab, _, a) => tab.addEventListener("click", function () {
	a.forEach(e => e.classList.remove("active"));
	tab.classList.add("active");
	document.querySelectorAll(`.content .tab`).forEach(e => e.classList.remove("active"));
	document.querySelector(`.tab#${tab.id}`).classList.add("active");
}));

document.querySelector("span.optimizations").addEventListener("click", window.electron.distributedMode);
