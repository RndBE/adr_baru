<style>
	:root {
		--bg: #f6f7fb;
		--card: rgba(255, 255, 255, .92);
		--border: rgba(15, 23, 42, .10);
		--ink: #0f172a;
		--muted: #475569;
		--soft: #334155
	}

	.page-wrapper {
		background: var(--bg)
	}

	.glass {
		background: var(--card);
		border: 1px solid var(--border);
		backdrop-filter: blur(10px);
		box-shadow: 0 10px 30px rgba(15, 23, 42, .08)
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
	}

	#plot {
		width: 100%;
		height: 78vh;
		min-height: 520px
	}

	.form-control,
	.form-select {
		background: #fff !important;
		border-color: rgba(15, 23, 42, .16) !important;
		color: var(--ink) !important
	}

	.form-label {
		color: var(--soft)
	}

	.text-soft {
		color: var(--muted)
	}

	.btn-grad {
		border: 1px solid rgba(15, 23, 42, .14);
		background: linear-gradient(135deg, rgba(59, 130, 246, .18), rgba(16, 185, 129, .10));
		color: var(--ink)
	}

	.btn-grad:disabled {
		opacity: .6
	}

	.logbox {
		white-space: pre-wrap;
		max-height: 260px;
		overflow: auto
	}

	.plot-wrap {
		position: relative
	}

	.fs-btn {
		position: absolute;
		left: 12px;
		top: 12px;
		z-index: 7
	}

	.fs-btn .btn {
		background: rgba(255, 255, 255, .92);
		border: 1px solid rgba(15, 23, 42, .14);
		color: var(--ink);
		backdrop-filter: blur(8px)
	}

	.fullscreen-target {
		background: var(--bg)
	}

	.fullscreen-target:fullscreen {
		background: var(--bg)
	}

	.fullscreen-target:fullscreen #plot {
		height: 100vh;
		min-height: 100vh
	}
</style>

<script src="https://cdn.plot.ly/plotly-2.33.0.min.js"></script>

<div class="container-xl mb-0">
	<!-- Page title -->
	<div class="page-header d-print-none">
		<div class="row g-2 align-items-center">
			<div class="col-12 mb-0 d-flex">
				<a href="<?= base_url() ?>beranda" class="me-2 mb-0 pb-0">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-big-left-line">
						<path stroke="none" d="M0 0h24v24H0z" fill="none" />
						<path d="M12 15v3.586a1 1 0 0 1 -1.707 .707l-6.586 -6.586a1 1 0 0 1 0 -1.414l6.586 -6.586a1 1 0 0 1 1.707 .707v3.586h6v6h-6z" />
						<path d="M21 15v-6" />
					</svg>
				</a>
				<h2 class="page-title mb-0">
					Lihat 3D
				</h2>

			</div>
		</div>
	</div>
</div>
<div class="container-fluid mt-2">
	<div class="row g-3">
		<div class="col-12 col-lg-3">
			<div class="card glass rounded-2">
				<div class="card-body">
					<div class="d-flex align-items-center">

						<h5 class="mb-0 fw-bold" style="color:var(--ink)">Deformasi RTS 3D</h5>
					</div>

					<div class="mt-2">
						<label class="form-label small mb-1">Pilih Tanggal</label>
						<select id="tanggal" name="tanggal" class="form-select form-select">
							<option disabled>Pilih Tanggal</option>
							<?php foreach ($log_data as $k => $v) { ?>
								<option value="<?= $v['id_log'] ?>" <?= $this->session->userdata('temp_kontrol')->id_log == $v['id_log'] ? 'selected' : '' ?>><?= $v['datetime'] ?> (<?= $v['site'] == 'ccp' ? 'CPP3' : 'VP' ?>)</option>
							<?php } ?>
						</select>
					</div>

					<div class="row g-2 mt-2">
						<div class="col-12 col-md-4">
							<label class="form-label small mb-1">RTS E</label>
							<input id="rtsE" class="form-control form-control" type="number" step="0.001">
						</div>
						<div class="col-12 col-md-4">
							<label class="form-label small mb-1">RTS N</label>
							<input id="rtsN" class="form-control form-control" type="number" step="0.001">
						</div>
						<div class="col-12 col-md-4">
							<label class="form-label small mb-1">RTS Z</label>
							<input id="rtsZ" class="form-control form-control" type="number" step="0.001">
						</div>
					</div>

					<div class="row g-2 mt-2">
						<div class="col-12 col-md-6">
							<label class="form-label small mb-1">Cone Scale</label>
							<input id="coneScale" class="form-control form-control" type="number" step="0.1" value="0.2">
						</div>
						<div class="col-12 col-md-6">
							<label class="form-label small mb-1">Threshold Linear</label>
							<input id="minLinear" class="form-control form-control" type="number" step="0.0001" value="0">
						</div>
					</div>
					<div class="row mt-3 gx-2">
						<div class="col">
							<div class="d-grid">
								<button id="btnLoad" class="btn btn-grad btn fw-bold">Load &amp; Render 3D</button>
							</div>
						</div>
					</div>




					<div class="mt-3">
						<div class="mono border rounded-3 p-2 logbox glass" id="log" style="border-color:rgba(15,23,42,.12)!important;color:var(--ink)"></div>
					</div>

				</div>
			</div>
		</div>

		<div class="col-12 col-lg-9">
			<div class="card glass rounded-2 bg-white overflow-hidden">
				<div class="card-body p-2 plot-wrap fullscreen-target bg-white" id="fsTarget">
					<div class="fs-btn">
						<button id="btnFS" class="btn btn-sm rounded-2 px-3 py-2 fw-semibold">Fullscreen</button>
					</div>
					<div id="plot"></div>
				</div>
			</div>
		</div>
	</div>
</div>

<script>
	const baseUrl = "<?= base_url() ?>"
	const elTanggal = document.getElementById("tanggal")
	const elLog = document.getElementById("log")
	const elBtnLoad = document.getElementById("btnLoad")
	const elE = document.getElementById("rtsE")
	const elN = document.getElementById("rtsN")
	const elZ = document.getElementById("rtsZ")
	const elConeScale = document.getElementById("coneScale")
	const elMinLinear = document.getElementById("minLinear")
	const elBtnFS = document.getElementById("btnFS")
	const elFsTarget = document.getElementById("fsTarget")

	let payload = null
	const loadBtnDefaultText = elBtnLoad ? elBtnLoad.textContent : ""

	function setLoadingState(isLoading) {
		if (!elBtnLoad) return
		elBtnLoad.disabled = !!isLoading
		elBtnLoad.textContent = isLoading ? "Loading..." : loadBtnDefaultText
	}

	function log(msg) {
		elLog.textContent = (elLog.textContent ? elLog.textContent + "\n" : "") + msg
		elLog.scrollTop = elLog.scrollHeight
	}

	function toNum(v) {
		if (v === null || v === undefined) return NaN
		if (typeof v === "number") return v
		const s = String(v).trim()
		if (!s) return NaN
		const n = Number(s.replace(/,/g, ".").replace(/[^0-9\.\-]/g, ""))
		return Number.isFinite(n) ? n : NaN
	}

	function isZeroish(a) {
		return Number.isFinite(a) && Math.abs(a) < 1e-12
	}

	function isTripletAllZero(a, b, c) {
		return isZeroish(a) && isZeroish(b) && isZeroish(c)
	}

	function getRTSFromPayload(p) {
		const r = p && p.posisi_rts ? p.posisi_rts : null
		if (!r) return null
		const E = toNum(r.E)
		const N = toNum(r.N)
		const Z = Number.isFinite(toNum(r.Z)) ? toNum(r.Z) : 0
		if (Number.isFinite(E) && Number.isFinite(N)) return {
			e: E,
			n: N,
			z: Z
		}
		const n = toNum(r.x)
		const e = toNum(r.y)
		if (!Number.isFinite(e) || !Number.isFinite(n)) return null
		return {
			e,
			n,
			z: 0
		}
	}

	function extractPoints(p) {
		const arr = (p && p.data_pengukuran) ? p.data_pengukuran : []
		const out = []
		for (const row of arr) {
			const t = row && row.temp_tembak ? row.temp_tembak : row
			if (!t) continue

			const id = row.id_prisma ? String(row.id_prisma) : (row.nama_prisma ? String(row.nama_prisma) : "")
			const name = row.nama_prisma ? String(row.nama_prisma) : (t.nama_prisma ? String(t.nama_prisma) : "")

			const e0 = toNum(t.E0)
			const n0 = toNum(t.N0)
			const z0 = toNum(t.Z0)

			if (![e0, n0, z0].every(Number.isFinite)) continue

			let e1 = toNum(t.E1)
			let n1 = toNum(t.N1)
			let z1 = toNum(t.Z1)

			const has1 = [e1, n1, z1].every(Number.isFinite) && !isTripletAllZero(e1, n1, z1)

			let de = toNum(t.DE)
			let dn = toNum(t.DN)
			let dz = toNum(t.DZ)

			if (has1) {
				if (!Number.isFinite(de)) de = e1 - e0
				if (!Number.isFinite(dn)) dn = n1 - n0
				if (!Number.isFinite(dz)) dz = z1 - z0
			} else {
				e1 = NaN
				n1 = NaN
				z1 = NaN
				de = NaN
				dn = NaN
				dz = NaN
			}

			let lin = toNum(t.linear)
			if (has1) {
				if (!Number.isFinite(lin)) lin = Math.sqrt(de * de + dn * dn + dz * dz)
			} else {
				lin = NaN
			}

			const dirText = t.arah_pergeseran ? String(t.arah_pergeseran) : ""

			out.push({
				id,
				name,
				e0,
				n0,
				z0,
				e1,
				n1,
				z1,
				de,
				dn,
				dz,
				lin,
				dirText,
				ok: has1
			})
		}
		return out
	}

	function finiteArr(a) {
		return a.filter(Number.isFinite)
	}

	function render(points, meta) {
		const RTS_E = Number(elE.value)
		const RTS_N = Number(elN.value)
		const RTS_Z = Number(elZ.value)
		const coneScale = Number(elConeScale.value)
		const minLinear = Number(elMinLinear.value)

		const baseline = points
		const moved = points.filter(p => p.ok && Number.isFinite(p.lin) && p.lin >= minLinear)

		log(`baseline prisms: ${baseline.length}`)
		log(`valid shots: ${points.filter(p=>p.ok).length}`)
		log(`render shots (threshold >= ${minLinear}): ${moved.length}`)

		if (baseline.length === 0) return

		const x0 = baseline.map(p => p.e0)
		const y0 = baseline.map(p => p.n0)
		const z0 = baseline.map(p => p.z0)

		const x1 = moved.map(p => p.e1)
		const y1 = moved.map(p => p.n1)
		const z1 = moved.map(p => p.z1)

		const u = moved.map(p => p.de)
		const v = moved.map(p => p.dn)
		const w = moved.map(p => p.dz)

		const lin = moved.map(p => p.lin)
		const maxLin = Math.max(...finiteArr(lin), 0)

		const lineX = []
		const lineY = []
		const lineZ = []
		for (const p of moved) {
			lineX.push(p.e0, p.e1, null)
			lineY.push(p.n0, p.n1, null)
			lineZ.push(p.z0, p.z1, null)
		}

		const hover0 = baseline.map(p =>
			`${p.name ? `${p.name}` : ""}<br>` +
			`E0=${p.e0.toFixed(4)} N0=${p.n0.toFixed(4)} Z0=${p.z0.toFixed(4)}<br>` +
			(p.ok ? `Status=OK` : `Status=GAGAL`)
		)

		const hover1 = moved.map(p =>
			`${p.name ? `${p.name}` : ""}<br>` +
			`E0=${p.e0.toFixed(4)} N0=${p.n0.toFixed(4)} Z0=${p.z0.toFixed(4)}<br>` +
			`E1=${p.e1.toFixed(4)} N1=${p.n1.toFixed(4)} Z1=${p.z1.toFixed(4)}<br>` +
			`DE=${p.de.toFixed(6)} DN=${p.dn.toFixed(6)} DZ=${p.dz.toFixed(6)}<br>` +
			`Linear=${p.lin.toFixed(6)}${p.dirText ? `<br>Arah=${p.dirText}` : ""}`
		)

		const traceBaseline = {
			type: "scatter3d",
			mode: "markers",
			name: "Baseline",
			x: x0,
			y: y0,
			z: z0,
			marker: {
				size: 4,
				color: "rgba(15,23,42,.55)"
			},
			text: hover0,
			hoverinfo: "text"
		}

		const traces = [traceBaseline]

		if (moved.length > 0) {
			const traceLines = {
				type: "scatter3d",
				mode: "lines",
				name: "Displacement",
				x: lineX,
				y: lineY,
				z: lineZ,
				line: {
					width: 3
				},
				opacity: 0.75,
				hoverinfo: "skip"
			}
			const traceDeformed = {
				type: "scatter3d",
				mode: "markers",
				name: "Hasil",
				x: x1,
				y: y1,
				z: z1,
				marker: {
					size: 6,
					color: lin,
					colorscale: "Turbo",
					colorbar: {
						title: "Linear"
					}
				},
				text: hover1,
				hoverinfo: "text"
			}
			const traceCone = {
				type: "cone",
				name: "Vector",
				x: moved.map(p => p.e0),
				y: moved.map(p => p.n0),
				z: moved.map(p => p.z0),
				u: u,
				v: v,
				w: w,
				anchor: "tail",
				sizemode: "absolute",
				sizeref: Math.max(maxLin * coneScale, 0.01),
				showscale: false,
				opacity: 0.85,
				hoverinfo: "skip"
			}
			traces.push(traceLines, traceDeformed, traceCone)
		}

		const traceRTS = {
			type: "scatter3d",
			mode: "markers+text",
			name: "RTS",
			x: [RTS_E],
			y: [RTS_N],
			z: [RTS_Z],
			marker: {
				size: 9,
				symbol: "diamond",
				color: "rgba(239,68,68,.95)"
			},
			text: ["RTS"],
			textposition: "top center",
			hoverinfo: "skip"
		}
		traces.push(traceRTS)

		const allX = finiteArr(x0.concat(x1))
		const allY = finiteArr(y0.concat(y1))
		const allZ = finiteArr(z0.concat(z1))

		const minX = Math.min(...allX),
			maxX = Math.max(...allX)
		const minY = Math.min(...allY),
			maxY = Math.max(...allY)
		const minZ = Math.min(...allZ),
			maxZ = Math.max(...allZ)

		const cx = (minX + maxX) / 2
		const cy = (minY + maxY) / 2
		const cz = (minZ + maxZ) / 2

		const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2 + (maxZ - minZ) ** 2)
		const L = Math.max(diag * 0.10, 1.0)

		const dirLineN = {
			type: "scatter3d",
			mode: "lines",
			showlegend: false,
			x: [cx, cx],
			y: [cy, cy + L],
			z: [cz, cz],
			line: {
				width: 5,
				color: "#B30000"
			},
			hoverinfo: "skip"
		}
		const dirLineE = {
			type: "scatter3d",
			mode: "lines",
			showlegend: false,
			x: [cx, cx + L],
			y: [cy, cy],
			z: [cz, cz],
			line: {
				width: 5,
				color: "#000000"
			},
			hoverinfo: "skip"
		}

		const dirLineS = {
			type: "scatter3d",
			mode: "lines",
			showlegend: false,
			x: [cx, cx],
			y: [cy, cy - L],
			z: [cz, cz],
			line: {
				width: 5,
				color: "#000000"
			},
			hoverinfo: "skip"
		}
		const dirLineW = {
			type: "scatter3d",
			mode: "lines",
			showlegend: false,
			x: [cx, cx - L],
			y: [cy, cy],
			z: [cz, cz],
			line: {
				width: 5,
				color: "#000000"
			},
			hoverinfo: "skip"
		}

		const dirText = {
			type: "scatter3d",
			mode: "text",
			showlegend: false,
			x: [cx + L * 1.12, cx, cx - L * 1.12, cx],
			y: [cy, cy + L * 1.12, cy, cy - L * 1.12],
			z: [cz, cz, cz, cz],
			text: ["E", "N", "W", "S"],
			textfont: {
				size: 16,
				color: "#0f172a"
			},
			hoverinfo: "skip"
		}

		traces.push(dirLineN, dirLineE, dirLineS, dirLineW, dirText)


		const title = meta && meta.tanggal ? `RTS Deformasi 3D — ${meta.tanggal}` : "RTS Deformasi 3D"

		const layout = {
			title: {
				text: title,
				font: {
					size: 16,
					color: "#0f172a"
				}
			},
			paper_bgcolor: "rgba(255,255,255,1)",
			plot_bgcolor: "rgba(255,255,255,1)",
			scene: {
				xaxis: {
					title: "Easting (E)",
					titlefont: {
						color: "#0f172a"
					},
					tickfont: {
						color: "#0f172a"
					}
				},
				yaxis: {
					title: "Northing (N/Y)",
					titlefont: {
						color: "#0f172a"
					},
					tickfont: {
						color: "#0f172a"
					}
				},
				zaxis: {
					title: "Elevation (Z)",
					titlefont: {
						color: "#0f172a"
					},
					tickfont: {
						color: "#0f172a"
					}
				},
				aspectmode: "data",
				bgcolor: "rgba(255,255,255,1)"
			},
			margin: {
				l: 0,
				r: 0,
				t: 40,
				b: 0
			},
			legend: {
				orientation: "h",
				font: {
					color: "#0f172a"
				}
			}
		}

		Plotly.newPlot("plot", traces, layout, {
			responsive: true
		})
	}

	function isFullscreen() {
		return !!document.fullscreenElement
	}

	async function toggleFullscreen() {
		if (!isFullscreen()) {
			if (elFsTarget.requestFullscreen) await elFsTarget.requestFullscreen()
		} else {
			if (document.exitFullscreen) await document.exitFullscreen()
		}
	}

	function syncFsBtn() {
		elBtnFS.textContent = isFullscreen() ? "Exit Fullscreen" : "Fullscreen"
		Plotly.Plots.resize("plot")
	}

	document.addEventListener("fullscreenchange", syncFsBtn)

	elBtnFS.addEventListener("click", () => {
		toggleFullscreen().catch(() => {})
	})

	async function loadJsonByIdLog(idLog) {
		const url = baseUrl + "beranda/get_deformasi_json/" + encodeURIComponent(idLog)
		const res = await fetch(url, {
			method: "GET",
			headers: {
				"Accept": "application/json"
			}
		})
		if (!res.ok) {
			const t = await res.text()
			throw new Error(t || ("HTTP " + res.status))
		}
		return await res.json()
	}

	elBtnLoad.addEventListener("click", async () => {
		elLog.textContent = ""
		payload = null

		const idLog = elTanggal.value
		if (!idLog) {
			log("Pilih tanggal terlebih dahulu.")
			return
		}

		try {
			setLoadingState(true)
			log("Loading...")
			payload = await loadJsonByIdLog(idLog)

			const rts = getRTSFromPayload(payload)
			if (rts) {
				elE.value = rts.e
				elN.value = rts.n
				elZ.value = Number.isFinite(rts.z) ? rts.z : 0
			}

			const n = (payload && payload.data_pengukuran) ? payload.data_pengukuran.length : 0
			log("Loaded JSON from server")
			log(`tanggal: ${payload.tanggal || "-"}`)
			log(`rows: ${n}`)

			const pts = extractPoints(payload)
			log(`parsed prisms: ${pts.length}`)
			log(`valid shots: ${pts.filter(x=>x.ok).length}`)
			log(`failed shots: ${pts.filter(x=>!x.ok).length}`)

			if (pts.length === 0) {
				log("Tidak ada prisma yang kebaca untuk id_log ini.")
				return
			}
			render(pts, payload)
			Plotly.Plots.resize("plot")
		} catch (e) {
			log(String(e && e.message ? e.message : e))
		} finally {
			setLoadingState(false)
		}
	})

	window.addEventListener("load", () => {
		if (elTanggal && elTanggal.value) {
			elBtnLoad.click()
		}
	})
</script>
