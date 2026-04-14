<?php 

$oneHourAgo = mktime(date("H") - 1, date("i"), 0, date("m"), date("d"), date("Y"));
$startTime  = date("Y-m-d H:i", $oneHourAgo);
$idLogger   = $this->session->userdata('idlogger');

$query_sensor = $this->db->query("
    SELECT * FROM parameter_sensor 
    WHERE logger_id = '$idLogger' AND kolom_sensor != 'debit'
    ORDER BY LENGTH(kolom_sensor), kolom_sensor
");

foreach ($query_sensor->result() as $s) {
    ${'data_'.$s->kolom_sensor} = [];
}

$query_data = $this->db->query("
    SELECT * FROM awlr 
    WHERE code_logger = '$idLogger' AND waktu >= '$startTime'
    ORDER BY waktu ASC
");

$latestTime = null;
$latestTMA  = null;

$buffer = [];
foreach ($query_sensor->result() as $s) {
    $buffer[$s->kolom_sensor] = [];
}

foreach ($query_data->result() as $row) {

    $ts    = strtotime($row->waktu);
    $year  = date('Y', $ts);
    $month = date('m', $ts) - 1;
    $day   = date('d', $ts);
    $hour  = date('H', $ts);
    $min   = date('i', $ts);

    foreach ($query_sensor->result() as $s) {

        $val = $row->{$s->kolom_sensor};
        $point = "[Date.UTC($year,$month,$day,$hour,$min), $val]";

        if ($s->nama_parameter == "Tinggi_Muka_Air") {
            ${'data_'.$s->kolom_sensor}[] = $point;
        } 
        else {
            $buffer[$s->kolom_sensor][] = $point;
        }
    }

    $latestTMA  = $row->sensor1;
    $latestTime = $row->waktu;
}

foreach ($query_sensor->result() as $s) {
    if ($s->nama_parameter != "Tinggi_Muka_Air") {
        ${'data_'.$s->kolom_sensor} = array_slice($buffer[$s->kolom_sensor], -15);
    }
}

$color  = ($latestTime >= $startTime) ? "green" : "red";
$status = ($latestTime >= $startTime) ? "Koneksi Terhubung" : "Koneksi Terputus";

// Ambil lokasi logger
$qLok = $this->db->query("
    SELECT * FROM t_logger 
    INNER JOIN t_lokasi ON t_lokasi.idlokasi = t_logger.lokasi_logger
    WHERE id_logger = '$idLogger'
");
$namaLokasi = $qLok->row()->nama_lokasi ?? "";

?>


<!-- ======================================================================
  2. HEADER STATUS LOGGER
  ====================================================================== -->
<div class="container-md">
	<div class="page-header d-print-none">
		<div class="row align-items-center justify-content-between">
			
			<div class="col-auto row align-items-center">
				<div class="col-auto">
					<span class="status-indicator status-<?= $color ?> status-indicator-animated">
						<span class="status-indicator-circle"></span>
						<span class="status-indicator-circle"></span>
						<span class="status-indicator-circle"></span>
					</span>
				</div>

				<div class="col">
					<h2 class="page-title">
						<?= $this->session->userdata('namalokasi'); ?>
					</h2>
					<div class="text-muted">
						<ul class="list-inline list-inline-dots mb-0">
							<li class="list-inline-item text-<?= $color ?>">
								<?= $status ?>
							</li>
						</ul>
					</div>
				</div>
			</div>
			<div class="col-auto">
				<button class="btn btn-outline-sucess mb-0" data-bs-target="#edit_siaga" data-bs-toggle="modal">Edit Tingkat Siaga</button>
			</div>
		</div>
	</div>
</div>


<!-- ======================================================================
  3. CHART CONTAINERS
  ====================================================================== -->
<div class="page-body">
	<div class="container-xl">
		<div class="row row-cards">
			<div class="col-3">
				<div class="card mb-3">
					<div class="card-header py-3">
						<h3 class="mb-0">Early Warning</h3>
					</div>
					<div class="card-body p-3">
						<div class="d-flex justify-content-between mb-2">
							<h4 class="mb-0">ID Logger</h4>
							<h4 class="mb-0">30002</h4>
						</div>
						<div class="d-flex justify-content-between mb-2">
							<h4 class="mb-0">Nama Pos</h4>
							<h4 class="mb-0">Pos AWLR Demo</h4>
						</div>
						<div class="d-flex justify-content-between mb-2">
							<h4 class="mb-0">Waktu Logger</h4>
							<h4 class="mb-0"><?= $latestTime?></h4>
						</div>
						<div class="d-flex justify-content-between mb-2">
							<h4 class="mb-0">Parameter Pantau</h4>
							<h4 class="mb-0">Tinggi Muka Air</h4>
						</div>
						<div class="d-flex justify-content-between mb-2">
							<h4 class="mb-0">Data Pantau Terkini</h4>
							<h4 class="mb-0"><?= $latestTMA ?> m</h4>
						</div>
						<div class="d-flex justify-content-between">
							<h4 class="mb-0">Status Siaga</h4>
							<h4 class="mb-0"><div class="badge bg-blue text-white">Aman</div></h4>
						</div>
					</div>
				</div>
				<div class="card">
					<div class="card-header py-3">
						<h3 class="mb-0">Riwayat Early Warning</h3>
					</div>
					<div class="card-body p-3">
						<p>Belum Ada Riwayat</p>
					</div>
				</div>
			</div>
			<div class="col-9">
				<div class="row row-cards">
					<?php foreach ($query_sensor->result() as $k=>$s): ?>

					<div class="<?= ($k == 0) ? 'col-md-12': 'col-md-6'?>">
						<div class="card">
							<div class="card-body text-start p-3">
								<div class="" id="container<?= $s->nama_parameter ?>"></div>
							</div>
						</div>
					</div>
					<?php endforeach; ?>
				</div>
			</div>
		</div>
	</div>
</div>
<!-- Modal Input SE -->
<div class="modal fade" id="edit_siaga" tabindex="-1" aria-labelledby="modalSELabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">

            <div class="modal-header text-dark">
                <h5 class="modal-title" id="modalSELabel">Edit Tingkat Siaga</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>

            <form action="<?= site_url('masterdata/editsiaga/'. $this->session->userdata('idlogger')) ?>" method="post">
                <div class="modal-body">

					<div class="mb-3">
						<label class="form-label">Siaga 1</label>
						<div class="input-group mb-3">
							<input type="text" name="se1" class="form-control" value="<?= $status_siaga['se1'] ?>" required>
							<span class="input-group-text">m</span>
						</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Siaga 2</label>
						<div class="input-group mb-3">
							<input type="text" name="se2" class="form-control" value="<?= $status_siaga['se2'] ?>" required>
							<span class="input-group-text">m</span>
						</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Siaga 3</label>
                        <div class="input-group mb-3">
							<input type="text" name="se3" class="form-control" value="<?= $status_siaga['se3'] ?>" required>
							<span class="input-group-text">m</span>
						</div>
                    </div>

                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Batal</button>
                    <button type="submit" class="btn btn-primary">Simpan</button>
                </div>

            </form>

        </div>
    </div>
</div>


<!-- ======================================================================
  4. JS SCRIPTS
  ====================================================================== -->
<script src="<?= base_url();?>js/highcharts.js"></script>
<script src="<?= base_url();?>js/modules/data.js"></script>
<script src="<?= base_url();?>js/modules/exporting.js"></script>
<script src="<?= base_url();?>js/highcharts-more.js"></script>
<script src="<?= base_url();?>js/themes/grid.js"></script>
<script src="<?= base_url();?>js/modules/no-data-to-display.js"></script>

<script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.1.0/mqttws31.js"></script>

<script>
	// ======================================================================
	// MQTT CONFIG
	// ======================================================================
	const MQTTbroker = "mqtt.beacontelemetry.com";
	const MQTTport   = 8083;
	const topic      = "<?= $idLogger ?>";

	let charts = {};
	let topicList = [];


	// ======================================================================
	// MQTT CLIENT
	// ======================================================================
	const client = new Paho.MQTT.Client(
		MQTTbroker,
		MQTTport,
		"client_" + Math.floor(Math.random() * 100000)
	);

	client.onMessageArrived = onMessageArrived;
	client.onConnectionLost = () => {};


	// ======================================================================
	// INIT FUNCTION (NEEDED BY <body onload="init()"> )
	// ======================================================================
	function init() {
		Highcharts.setOptions({
			time: { useUTC: false }
		});

		client.connect({
			timeout: 3,
			useSSL: true,
			userName: "userlog",
			password: "b34c0n",
			onSuccess: function () {
				console.log("MQTT Connected");
				client.subscribe(topic);
			}
		});
	}


	// ======================================================================
	// HELPER
	// ======================================================================
	function toTimestamp(w) {
		let d = new Date(w);
		return new Date(
			d.getFullYear(), d.getMonth(), d.getDate(),
			d.getHours() + 7, d.getMinutes(), 0
		).getTime();
	}

	function isNumber(n) {
		return !isNaN(parseFloat(n)) && isFinite(n);
	}


	// ======================================================================
	// HANDLE MQTT DATA
	// ======================================================================
	function onMessageArrived(msg) {
		let json = JSON.parse(msg.payloadString);
		let t = toTimestamp(json.waktu);
		console.log(json);
		if (!topicList.includes(msg.destinationName)) {
			topicList.push(msg.destinationName);
		}
		let idx = topicList.indexOf(msg.destinationName);

		<?php foreach ($query_sensor->result() as $s): ?>
		let val_<?= $s->kolom_sensor ?> = Number(json.<?= $s->kolom_sensor ?>);

		if (isNumber(val_<?= $s->kolom_sensor ?>)) {
			charts["<?= $s->nama_parameter ?>"]
				.series[idx]
				.addPoint([t, val_<?= $s->kolom_sensor ?>], true, false);
		}
		<?php endforeach; ?>
	}


	// ======================================================================
	// HIGHCHARTS INIT
	// ======================================================================
	document.addEventListener("DOMContentLoaded", function () {

		Highcharts.setOptions({
			chart: {
				backgroundColor: "#ffffff",
				style: { fontFamily: "Segoe UI, Roboto, sans-serif" }
			},
			exporting: { enabled: false },
			credits: { enabled: false }, // hilangkan watermark
		});

		<?php foreach ($query_sensor->result() as $kw=> $s): ?>
		charts["<?= $s->nama_parameter ?>"] = new Highcharts.Chart({
			chart: {
				renderTo: "container<?= $s->nama_parameter ?>",
				type: "areaspline",
				zoomType: "xy",
				backgroundColor: "#ffffff",
				borderWidth: 2,                // ✅ ketebalan border
				borderColor: "#303481",           // ✅ warna border
				borderRadius: 5,                 // ✅ radius border
				plotBorderWidth: 0,
				plotBorderColor: "#cccccc",
				<?php if ($kw == 0): ?>

				height: 400
				<?php else: ?>
				height: 300
				<?php endif; ?>
			},

			title: {
				text: "<?= str_replace('_',' ',$s->nama_parameter) ?>",
				style: { fontSize: "14px", fontWeight: "600", color: "#333" }
			},

			xAxis: {
				type: "datetime",
				lineWidth: 0,      // ✅ Remove axis line
				tickLength: 0,     // ✅ Remove ticks
				gridLineWidth: 0,  // ✅ Remove grid
				tickLength: 8,              // ✅ Panjang tick kecil
				tickWidth: 1.5,             // ✅ Lebar tick
				tickColor: "#cccccc",       // ✅ Warna tick tipis elegan
				labels: {
					style: { fontSize: "10px", color: "#666" }
				}
			},

			yAxis: {
				
				// ✅ Chart selalu tampil sampai 4 meter
				title: { text: "" },
				gridLineWidth: 0,         // 🔥 hilangkan garis utama
				minorGridLineWidth: 0,    // 🔥 hilangkan minor grid
				lineWidth: 0,             // 🔥 hilangkan axis line
				tickLength: 0,  
				labels: { enabled: true },
				<?php if ($kw == 0): ?>
				// ✅ GARIS SIAGA HANYA UNTUK CHART PERTAMA
				
				plotLines: [
					{
						value: <?= (float) $status_siaga['se3'] ?>,
						color: "#228B22",
						dashStyle: "Dash",
						width: 2,
						zIndex: 5,
						label: {
							text: "Siaga 3",
							align: "left",
							x: 10,
							style: { color: "#228B22", fontSize: "13px" ,fontWeight:'bold'}
						}
					},
					{
						value: <?= (float) $status_siaga['se2'] ?>,
						color: "#ffc107",
						dashStyle: "Dash",
						width: 2,
						zIndex: 5,
						label: {
							text: "Siaga 2",
							align: "left",
							x: 10,
							style: { color: "#ffc107", fontSize: "13px" ,fontWeight:'bold'}
						}
					},
					{
						value: <?= (float) $status_siaga['se1'] ?>,
						color: "#fd7e14",
						dashStyle: "Dash",
						width: 2,
						zIndex: 5,
						label: {
							text: "Siaga 1",
							align: "left",
							x: 10,
							style: { color: "#fd7e14", fontSize: "13px"  ,fontWeight:'bold'}
						}
					}
				]
				<?php endif; ?>
			},

			tooltip: {
				shared: true,
				backgroundColor: "rgba(255,255,255,0.95)",
				borderRadius: 6,
				borderWidth: 1,
				style: { fontSize: "12px" },
				valueSuffix: " <?= $s->satuan ?>"
			},

			plotOptions: {

				areaspline: {
					lineWidth: 3,
					color: "#007bff",
					fillOpacity: 0.25,
					marker: {
						enabled: true,
						radius: 4,                 // ✅ DOT SIZE
						lineWidth: 2,
						fillColor: "#ffffff",      // ✅ middle white
						lineColor: "#007bff"       // ✅ border blue (clean)
					},
					states: {
						hover: {
							lineWidth: 3.5
						}
					}
				}
			},

			series: [{
				name: "<?= str_replace('_',' ', $s->nama_parameter )?>",
				data: [<?= join(${'data_'.$s->kolom_sensor}, ',') ?>],
				fillColor: {
					linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
					stops: [
						[0, "rgba(0,123,255,0.45)"],   // bagian atas
						[1, "rgba(0,123,255,0.0)"]     // fade to transparent
					]
				}
			}]
		});
		<?php endforeach; ?>

	});

</script>

<!-- Jalankan MQTT saat halaman load -->
<body onload="init()"></body>
