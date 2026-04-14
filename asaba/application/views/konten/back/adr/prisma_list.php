<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<script src="<?php echo base_url(); ?>code/highcharts.js"></script>
<script src="<?php echo base_url(); ?>code/highcharts-more.js"></script>
<script src="<?php echo base_url(); ?>code/modules/series-label.js"></script>
<script src="<?php echo base_url(); ?>code/modules/exporting.js"></script>
<script src="<?php echo base_url(); ?>code/modules/export-data.js"></script>
<script src="<?php echo base_url(); ?>code/js/themes/grid.js"></script>
<style>
	.menu-card, .prisma-menu {
		cursor: pointer;
		transition: 0.25s;
		border: 1.5px solid #f1f1f1;
	}
	.menu-card:hover, .prisma-menu:hover {
		border-color: #303481;
		transform: scale(1.05);
	}


</style>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
<link href="https://bbwsso.monitoring4system.com/code/bootstrap5-toggle.min.css" rel="stylesheet" />
<script src="https://bbwsso.monitoring4system.com/code/bootstrap5-toggle.jquery.min.js"></script>
<div class="container-md">
	<div class="page-header d-print-none ">
		<div class="row g-3 align-items-center justify-content-between">
			<div class="col-auto d-flex align-items-center">

				<?php
				echo anchor('adr/kontrol', '<svg xmlns="http://www.w3.org/2000/svg" class="me-3 icon icon-tabler icon-tabler-arrow-big-left-lines" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
			<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
			<path d="M12 15v3.586a1 1 0 0 1 -1.707 .707l-6.586 -6.586a1 1 0 0 1 0 -1.414l6.586 -6.586a1 1 0 0 1 1.707 .707v3.586h3v6h-3z"></path>
			<path d="M21 15v-6"></path>
			<path d="M18 15v-6"></path>
		</svg>
') ?>
				<span class="status-indicator status-<?= ($status_logger) ? 'green' : 'dark' ?> status-indicator-animated">
					<span class="status-indicator-circle"></span>
					<span class="status-indicator-circle"></span>
					<span class="status-indicator-circle"></span>
				</span>
				<div class="ms-2">
					<h2 class="page-title mb-1">
						<?= $info_logger->nama_lokasi ?>

					</h2>
					<div class="text-muted">
						<ul class="list-inline list-inline-dots mb-0">

							<li class="list-inline-item"><span class="text-<?= ($status_logger) ? 'green' : 'black' ?>"><?= ($status_logger) ? 'Koneksi Terhubung' : 'Koneksi Terputus' ?> </span></li>

						</ul>
					</div>
				</div>
			</div>

			<div class="col-12 col-md-auto d-flex align-items-center">
				<?php if ($status_kontrol->status_operation != 0 and $status_kontrol->status_operation == $this->session->userdata('device_id')) {?>
				<button class="btn btn-outline-danger py-2 bg-white text-danger"  data-bs-toggle="modal" data-bs-target="#stop_konfig">
					<svg xmlns="http://www.w3.org/2000/svg" class="me-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-settings-pause"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13.004 20.69c-.905 .632 -2.363 .296 -2.679 -1.007a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.314 .319 1.645 1.798 .992 2.701" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17 17v5" /><path d="M21 17v5" /></svg>
					Berhenti Konfigurasi
				</button>
				<?php } elseif ($status_kontrol->status_operation != 0 and $status_kontrol->status_operation != $this->session->userdata('device_id')) {?>
				<div class="border rounded fw-bold border-danger px-3 py-2 bg-white text-danger"  data-bs-toggle="modal" data-bs-target="#hentiConfig">
					Konfigurasi Sedang Digunakan
				</div>
				<?php }else{ ?>
				
				<button class="btn py-2 bg-white text-secondary"  data-bs-toggle="modal" data-bs-target="#kodeAksesModal">
					<svg xmlns="http://www.w3.org/2000/svg" class="me-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-automation"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13 20.693c-.905 .628 -2.36 .292 -2.675 -1.01a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.492 .362 1.716 2.219 .674 3.03" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17 22l5 -3l-5 -3z" /></svg>
					Mulai Konfigurasi
				</button>
				<?php } ?>
				
				
				<a class="btn w-100 border-danger btn-kontrol text-danger <?= ($status_kontrol->status_manual == '0') ? 'd-none': '' ?>  " role="button">
					<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-alert-square-rounded text-danger" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
						<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
						<path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z"></path>
						<path d="M12 8v4"></path>
						<path d="M12 16h.01"></path>
					</svg>
					RTS Sedang Beroperasi
				</a>
			</div>

		</div>
	</div>
</div>

<div class="page-body">
	<div class="container-xl">
		<div class="row gy-3">
			<div class="col-12">
				<div class="card">
					<div class="card-header">
						<h4 class="mb-0">Daftar Prisma</h4>
					</div>
					<div class="card-body">
						<table class="table table-bordered">
							<thead>
								<tr>
									<th>No</th>
									<th>Prisma ID</th>
									<th>Prisma Name</th>
									<th>HA</th>
									<th>VA</th>
									<th>Target Height</th>
									<th>Aksi</th>
								</tr>
							</thead>

							<tbody>

								<?php foreach($list_prisma as $k=>$v) { ?>
								<tr>
									<td width="10px"><?= $v['id'] ?></td>
									<td><?= ($v['nama_prisma']) ? $v['id_prisma']: $v['id_prisma'] ?></td>
									<td><?= ($v['nama_prisma']) ? $v['nama_prisma']: '<small class="text-secondary text-italic">Not Set</small>' ?></td>
									<td><?= ($v['nama_prisma']) ? $v['HA']: '<small class="text-secondary text-italic">Not Set</small>' ?></td>
									<td><?= ($v['nama_prisma']) ? $v['VA']: '<small class="text-secondary text-italic">Not Set</small>' ?></td>
									<td><?= ($v['nama_prisma']) ? $v['target_height']: '<small class="text-secondary text-italic">Not Set</small>' ?></td>
									<td>
										<div class="d-flex">
											<button 
													class="btn btn-outline-primary me-2 btn-open-prisma"
													data-type="<?= $v['nama_prisma'] ? 'update' : 'set' ?>"
													data-id="<?= $v['id'] ?>"
													data-nama="<?= $v['nama_prisma'] ?>"
													data-height="<?= $v['target_height'] ?>"
													<?= ($status_kontrol->status_operation != $this->session->userdata('device_id')) ? 'disabled':'' ?>>
												<?= $v['nama_prisma'] ? 'Update' : 'Set' ?>
											</button>

										</div>
									</td>
								</tr>
								<?php } ?>

							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="modal fade" id="prismaModal" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">

				<div class="modal-header">
					<h5 class="modal-title" id="prismaModalTitle">Set Prisma</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
				</div>

				<div class="modal-body">
					<form id="formPrisma" method="post">

						<input type="hidden" name="slot_id" id="slot_id">

						<div class="mb-3">
							<label class="form-label">Nama Prisma</label>
							<input type="text" class="form-control" name="nama_prisma" id="nama_prisma">
						</div>

						<div class="mb-3">
							<label class="form-label">Target Height</label>
							<input type="number" class="form-control" name="target_height" id="target_height">
						</div>
						<div class="w-100 d-flex justify-content-between align-items-center  mb-3">
							<button 
									class="btn btn-warning " 
									id="btnGoTarget"
									data-slot=""
									>
								Go To Target
								<span class="spinner-border spinner-border-sm ms-2 d-none" id="spinGoTarget"></span>
							</button>
							<span id="textTarget"></span>
						</div>
						<div class="w-100 d-flex justify-content-between align-items-center  mb-4">
							<button 
									class="btn btn-info" 
									id="btnAutoSearch"
									>
								Auto Search
								<span class="spinner-border spinner-border-sm ms-2 d-none" id="spinAutoSearch"></span>
							</button>
							<span id="textSearch"></span>
						</div>

						<button type="submit" id="btnPrisma" class="btn btn-primary w-100" disabled>
							Simpan
						</button>

					</form>
				</div>

			</div>
		</div>
	</div>
	<div class="modal fade" id="kodeAksesModal" tabindex="-1" aria-labelledby="kodeAksesLabel" aria-hidden="true">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content shadow-lg border-0">
				<div class="modal-header text-dark py-2 px-3">
					<h5 class="modal-title" id="kodeAksesLabel">Masukkan Kode Akses</h5>
					<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>

				<form action="<?= base_url('adr/mulai_config'); ?>" method="post" id="formKodeAkses">
					<div class="modal-body py-3 px-3">
							<label for="kodeAkses" class="form-label">Kode Akses</label>
							<div class="input-group">
								<input 
									   type="password" 
									   class="form-control" 
									   id="kodeAkses" 
									   name="kode_akses" 
									   placeholder="Masukkan kode akses" 
									   required>
								<button class="btn" type="button" id="togglePassword">
									<i class="bi bi-eye-slash" id="eyeIcon"></i>
								</button>
							</div>
					</div>
					<div class="modal-footer py-2">
						<button type="button" class="btn btn-outline-danger"  data-bs-dismiss="modal" aria-label="Close">
							Batal
						</button>
						<button type="submit" class="btn btn-outline-primary">
							Kirim
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
	<div class="modal fade" id="stop_konfig" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
		<div class="modal-dialog modal-dialog-centered modal-sm">
			<div class="modal-content">
				<div class="modal-body text-center">
					Selesai Konfigurasi ? 
					<div class="d-flex mt-3 justify-content-center">
						<button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Tutup</button>
						<a href="<?= base_url() ?>adr/selesai_config" class="btn btn-primary">Ya</a>
					</div>
				</div>
			</div>
		</div>
	</div>

</div>


<script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.js" type="text/javascript"></script>
<script>
	$(document).on("click", ".btn-open-prisma", function () {

		let type   = $(this).data("type");  // set OR update
		let id     = $(this).data("id");
		let nama   = $(this).data("nama") || "";
		let height = $(this).data("height");

		if (type === "set") {
			$("#prismaModalTitle").text("Set Prisma");
			$("#formPrisma").attr("action", "<?= base_url('adr/input_prisma') ?>");

			$("#nama_prisma").val("");
			$("#target_height").val("");

			// ❌ Go To Target disembunyikan
			$("#btnGoTarget").addClass("d-none");
			$("#textTarget").addClass("d-none");

			// ✅ AutoSearch tetap ada
			$("#btnAutoSearch").removeClass("d-none");
			$("#textSearch").removeClass("d-none").text("");

			// Submit dikunci dulu
			$("#btnPrisma").prop("disabled", true);

		} else {
			$("#prismaModalTitle").text("Update Prisma");
			$("#formPrisma").attr("action", "<?= base_url('adr/update_prisma') ?>");

			$("#nama_prisma").val(nama);
			$("#target_height").val(height);

			// === MODE UPDATE → TAMPILKAN CONTROL ACTION ===
			$("#btnGoTarget").removeClass("d-none");
			$("#btnAutoSearch").removeClass("d-none");
			$("#textTarget").removeClass("d-none").text("");
			$("#textSearch").removeClass("d-none").text("");

			// Submit disabled sampai AutoSearch = sukses
			$("#btnPrisma").prop("disabled", true);
		}


		$("#slot_id").val(id);
		$("#prismaModal").modal("show");
	});


	let isGoTargetWaiting = false;
	let isAutoSearchWaiting = false;
	$("#btnGoTarget").on("click", function () {
		let slot = $("#slot_id").val(); // ambil slot dari modal
		isGoTargetWaiting = true;
		$("#btnAutoSearch").prop("disabled", true);     // lock auto search
		$("#spinGoTarget").removeClass("d-none");   // show spinner
		$(this).prop("disabled", true);
		$("#textTarget").text("Sending command...");
		$.ajax({
			url: "<?= base_url('adr/go_target') ?>",
			type: "POST",
			data: { slot_id: slot },
			dataType: "json",
			success: function (res) {
				$("#textTarget").text("Waiting ...");
			},
			error: function () {
				$("#spinGoTarget").addClass("d-none");
				$("#btnGoTarget").prop("disabled", false);
				$("#btnAutoSearch").prop("disabled", false);
				$("#btnPrisma").prop("disabled", false);
				$("#textTarget").text("Failed to send");
				isGoTargetWaiting = false;
			}
		});
	});

	$("#btnAutoSearch").on("click", function () {
		isAutoSearchWaiting = true;
		$("#spinAutoSearch").removeClass("d-none");
		$(this).prop("disabled", true);
		$("#textSearch").text("Sending command...");
		$("#btnGoTarget").prop("disabled", true);    
		$.ajax({
			url: "<?= base_url('adr/auto_search') ?>",
			type: "POST",
			dataType: "json",
			success: function (res) {
				$("#textSearch").text("Waiting ...");
			},
			error: function () {
				$("#spinAutoSearch").addClass("d-none");
				$("#btnAutoSearch").prop("disabled", false);
				$("#btnGoTarget").prop("disabled", false);
				$("#btnPrisma").prop("disabled", false);
				$("#textSearch").text("Failed to send");
				isAutoSearchWaiting = false;
			}
		});
	});



	$("#formPrisma").on("submit", function (e) {
		e.preventDefault();

		let btn = $("#btnPrisma");
		btn.prop("disabled", true);
		btn.html(`<span class="spinner-border spinner-border-sm me-2"></span> Menyimpan...`);

		$.ajax({
			url: $(this).attr("action"),
			type: "POST",
			data: $(this).serialize(),
			dataType: "json",
			success: function(res) {
				if (res.status) {
					console.log("Menunggu feedback MQTT…");
				} else {
					Swal.fire("Gagal", res.message, "error");
					btn.prop("disabled", false).html("Simpan");
				}
			},
			error: function() {
				btn.prop("disabled", false).html("Simpan");
			}
		});
	});
	$("#togglePassword").on("click", function () {
		const $passwordField = $("#kodeAkses");
		const $icon = $("#eyeIcon");

		if ($passwordField.attr("type") === "password") {
			$passwordField.attr("type", "text");
			$icon.removeClass("bi-eye-slash").addClass("bi-eye");
		} else {
			$passwordField.attr("type", "password");
			$icon.removeClass("bi-eye").addClass("bi-eye-slash");
		}
	});
	$(document).ready(function() {


		var MQTTbroker = 'mqtt.beacontelemetry.com';
		var MQTTport = 8083;
		var MQTTsubTopic = "ADR_Tambang_Kaltara";
		var dataTopics = new Array();
		var client = new Paho.MQTT.Client(MQTTbroker, MQTTport,
										  "clientid_" + parseInt(Math.random() * 100, 10));
		client.onMessageArrived = onMessageArrived;
		client.onConnectionLost = onConnectionLost;
		console.log(MQTTsubTopic);
		var options = {
			timeout: 3,
			useSSL: true,
			userName : "userlog",
			password : "b34c0n",

			onSuccess: function () {
				console.log("mqtt connected");
				client.subscribe(MQTTsubTopic, {qos: 0});
			},
			onFailure: function (message) {
				console.log(message);
			}
		};
		function onConnectionLost(responseObject) {
		};
		function onMessageArrived(message) {
			var dataLog = message.payloadString;
			var dataLogObj = JSON.parse(dataLog);

			if (message.destinationName == 'ADR_Tambang_Kaltara') {
				if (dataLogObj.recordTarget) {
					let nama_prisma = dataLogObj.recordTarget.TargetName; // CPM3
					let HA = dataLogObj.recordTarget.HA;                  // 347,37,46
					let VA = dataLogObj.recordTarget.VA;                  // 085,17,07

					$.ajax({
						url: "<?= base_url('adr/prism_set') ?>",
						type: "POST",
						dataType: "json",
						data: {
							nama_prisma: nama_prisma,
							HA: HA,
							VA: VA
						},
						success: function (res) {
							location.reload();
						},
						error: function (res2) {
							console.log(res2);
						}
					});
				}

				if (dataLogObj.TurningTarget) {
					isGoTargetWaiting = false;

					$("#spinGoTarget").addClass("d-none");
					$("#btnGoTarget").prop("disabled", false);
					$("#btnAutoSearch").prop("disabled", false); // unlock auto search

					$("#textTarget").text("✅ Target reached!");
				}


				if (dataLogObj.AutoSearch) {
					isAutoSearchWaiting = false;

					$("#spinAutoSearch").addClass("d-none");
					$("#btnAutoSearch").prop("disabled", false);
					$("#btnGoTarget").prop("disabled", false); // unlock go target
					$("#btnPrisma").prop("disabled", false);   // unlock submit

					$("#textSearch").text("✅ Auto search complete!");
				}
			}
		}

		client.connect(options);
	});
</script>