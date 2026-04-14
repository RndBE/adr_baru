<style>
	.hide-scrollbar::-webkit-scrollbar {
		display: none;
	}

	.gm-style-iw-chr {
		position: absolute;
		right: 0px
	}

	#map {
		width: 100%;
		height: 600px;
	}

	.label-road {
		color: #000;
		font-weight: 700;
		font-size: 14px;
		background: transparent;
		border: none;
		box-shadow: none;
	}

	.label-sat {
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		background: transparent;
		border: none;
		box-shadow: none;
		text-shadow: 0 1px 2px rgba(0, 0, 0, .8);
	}

	.list-group-item-action:hover {
		background-color: #f0f2f3
	}

	#logList .list-group-item.page-first {
		border-top: 1px solid #dee2e6;
		border-top-left-radius: .375rem;
		border-top-right-radius: .375rem;
	}

	#logList .list-group-item.page-last {
		border-bottom-left-radius: .375rem;
		border-bottom-right-radius: .375rem;
	}

	#logList .list-group-item.page-first.with-top-border {
		border-top: 1px solid #dee2e6;
	}
</style>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<script src="https://cdn.jsdelivr.net/npm/boldtrn-leaflet-polylinedecorator@1.7.0/dist/leaflet.polylineDecorator.js"></script>



<div class="container-xl mb-0">
	<div class="page-header d-print-none">
		<div class="row g-2 align-items-center">
			<div class="col-12 mb-0">
				<h2 class="page-title mb-0">
					Beranda
				</h2>
			</div>
		</div>
	</div>
</div>
<div class="page-body mt-2">
	<div class="container-xl ">
		<div class="row row-cards hide-scrollbar px-0">
			<?php foreach ($data_konten as $key => $kt) { ?>
				<?php if ($kt['tabel'] == 'rts') { ?>
					<div class="col-lg-12">
						<div class="card">
							<div class="card-header">
								<h3 class="card-title"><strong><?= $kt['nama_kategori'] ?>
									</strong> <?= ($kt['kepanjangan']) ? '(' . $kt['kepanjangan'] . ')' : '' ?></h3>
							</div>
							<div class="card-body">
								<div class="row row-cards">
									<?php foreach ($kt['logger'] as $log) { ?>
										<div class="col-xl-12">
											<div class="card">
												<div class="card-status-top bg-<?= $log['color'] ?>"></div>
												<div class="ribbon bg-<?= $log['color'] ?>"> <?= $log['waktu'] ?>
													<div class="card-actions">
														<div class="dropdown">
															<a href="#" class="btn-icon" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
																<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-list" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="white" fill="none" stroke-linecap="round" stroke-linejoin="round">
																	<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
																	<line x1="9" y1="6" x2="20" y2="6"></line>
																	<line x1="9" y1="12" x2="20" y2="12"></line>
																	<line x1="9" y1="18" x2="20" y2="18"></line>
																	<line x1="5" y1="6" x2="5" y2="6.01"></line>
																	<line x1="5" y1="12" x2="5" y2="12.01"></line>
																	<line x1="5" y1="18" x2="5" y2="18.01"></line>
																</svg>

															</a>
															<div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
																<div class="dropdown-item">
																	<strong><a href="#" class="text-reset">Id Logger</a></strong>
																	<label class="form-check m-0 ms-auto">
																		<?= $log['id_logger'] ?>
																	</label>
																</div>
																<div class="dropdown-item">
																	<strong><a href="#" class="text-reset">Status Logger</a></strong>
																	<label class="form-check m-0 ms-auto">
																		<?= $log['status_logger'] ?>
																	</label>
																</div>
																<div class="dropdown-item">
																	<strong><a href="#" class="text-reset">Status SD Card</a></strong>
																	<label class="form-check m-0 ms-auto">
																		<?= $log['status_sd'] ?>
																	</label>
																</div>
															</div>
														</div>
													</div>
												</div>
												<div class="card-header py-3 d-flex align-items-center justify-content-between">
													<h3 class="card-title me-3"><?= $log['nama_lokasi'] ?></h3>
												</div>
												<div class="card-body">
													<div class="row mb-3 gy-3 justify-content-center">
														<div class="col-md-4 col-lg-3 col-xl-2">
															<div class="card h-100">
																<div class="card-body d-flex justify-content-center ">
																	<a class="btn btn-primary py-1 px-4" href="<?= base_url() ?>adr/kontrol">Kontrol ADR</a>
																</div>
															</div>
														</div>
														<div class="col-md-4 col-lg-3 col-xl-2">
															<div class="card h-100">
																<div class="card-body d-flex flex-column justify-content-center text-center py-3">
																	<h3 class="fw-normal mb-1">Status RTS</h3>
																	<h3 class="fw-bold mb-0"><?= $log['data_dashboard']['status'] ?></h3>
																</div>
															</div>
														</div>
														<div class="col-md-4 col-lg-3 col-xl-2">
															<div class="card h-100">
																<div class="card-body d-flex flex-column justify-content-center text-center py-3">
																	<a href="<?= base_url() ?>adr/set_dashlogger?tabel=adr&id_param=328">
																		<h3 class="fw-normal mb-1">Power RTS</h3>
																	</a>
																	<h2 class="fw-bold mb-0"><?= $log['data_dashboard']['power_rts'] ?> Volt</h2>
																</div>
															</div>
														</div>
														<div class="col-md-4 col-lg-3 col-xl-2">
															<div class="card h-100">
																<div class="card-body d-flex flex-column justify-content-center text-center py-3">
																	<a href="<?= base_url() ?>adr/set_dashlogger?tabel=adr&id_param=152">
																		<h3 class="fw-normal mb-1">Humidity Logger</h3>
																	</a>
																	<h2 class="fw-bold mb-0"><?= $log['data_dashboard']['humidity'] ?> %</h2>
																</div>
															</div>
														</div>
														<div class="col-md-4 col-lg-3 col-xl-2">
															<div class="card h-100">
																<div class="card-body d-flex flex-column justify-content-center text-center py-3">
																	<a href="<?= base_url() ?>adr/set_dashlogger?tabel=adr&id_param=153">
																		<h3 class="fw-normal mb-1">Battery Logger</h3>
																	</a>
																	<h2 class="fw-bold mb-0"><?= $log['data_dashboard']['baterai'] ?> Volt</h2>
																</div>
															</div>
														</div>
														<div class="col-md-4 col-lg-3 col-xl-2">
															<div class="card">
																<div class="card-body d-flex flex-column justify-content-center text-center py-3">
																	<a href="<?= base_url() ?>adr/set_dashlogger?tabel=adr&id_param=154">
																		<h3 class="fw-normal mb-1">Temperature Logger</h3>
																	</a>
																	<h2 class="fw-bold mb-0"><?= $log['data_dashboard']['temperature'] ?> °C</h2>
																</div>
															</div>
														</div>
													</div>
													<div class="row gy-3">
														<div class="col-md-4 col-lg-3 col-xxl-2">
															<div class="card border-0">
																<div class="card-header py-3 border rounded">
																	<b>Tanggal Running</b>
																</div>
																<div class="card-body pb-2 px-0 pt-2">
																	<div class="list-group">
																		<div id="logList" class="list-group ">
																			<?php if (!$log_data) { ?>
																				<h4 class="text-center fw-normal mb-0">Tidak Terdapat Data</h4>
																			<?php } ?>
																			<?php foreach ($log_data as $k => $vl) { ?>
																				<a href="<?= base_url() ?>beranda/ubah_tanggal?id_log=<?= $vl['id_log'] ?>"
																					class="list-group-item py-3 list-group-item-action <?= ($this->session->userdata('temp_kontrol')->id_log == $vl['id_log']) ? 'active bg-muted-lt text-dark' : '' ?>"
																					aria-current="true">
																					<?= $vl['datetime'] ?>
																					<div class="badge text-uppercase <?= $vl['site'] == 'ccp' ? 'bg-azure' : 'bg-warning' ?> text-white ms-2"><?= $vl['site'] == 'ccp' ? 'cpp 3' : 'vp' ?></div>
																					<?= $vl['r0'] == '1' ? '<div class="badge bg-secondary text-white ms-2">R0</div>' : '' ?>
																				</a>
																			<?php } ?>
																		</div>

																		<ul id="logPager" class="pagination mt-3 d-flex justify-content-center"></ul>
																	</div>
																</div>
															</div>
														</div>
														<div class="col-md-8 col-lg-9 col-xxl-10">
															<div class="card">
																<div class="card-header py-2 pe-0">
																	<div class="row justify-content-between w-100 gy-2">
																		<div class="col-lg-auto d-flex align-items-center justify-content-between">
																			<h4 class="mb-0">Data Prisma</h4>
																			<span class="ms-2 badge bg-cyan-lt">Date Selected : <?= $this->session->userdata('temp_kontrol')->datetime ?></span>
																		</div>
																		<div class="col-lg-auto justify-content-between d-flex">
																			<a href="<?= base_url() ?>beranda/view_3d" class="btn btn-outline-primary py-2 me-3"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-rotate-3d">
																					<path stroke="none" d="M0 0h24v24H0z" fill="none" />
																					<path d="M12 3a7 7 0 0 1 7 7v4l-3 -3" />
																					<path d="M22 11l-3 3" />
																					<path d="M8 15.5l-5 -3l5 -3l5 3v5.5l-5 3z" />
																					<path d="M3 12.5v5.5l5 3" />
																					<path d="M8 15.545l5 -3.03" />
																				</svg>Lihat 3D</a>
																			<form method="post" action="<?= base_url() ?>beranda/export_excel">
																				<input type="text" name="parameter" value='<?= json_encode($log["temp_prisma"], JSON_HEX_APOS | JSON_HEX_QUOT) ?>' class="d-none" />
																				<input type="text" name="tanggal" class="d-none" />
																				<button type="submit" class="btn btn-outline-teal py-2 me-3"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-file-download">
																						<path stroke="none" d="M0 0h24v24H0z" fill="none" />
																						<path d="M14 3v4a1 1 0 0 0 1 1h4" />
																						<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
																						<path d="M12 17v-6" />
																						<path d="M9.5 14.5l2.5 2.5l2.5 -2.5" />
																					</svg>Download Excel</button>
																			</form>
																			<div class="d-flex rounded border" style="overflow:hidden">
																				<button class="bg-transparent border-0 p-0 m-0" onclick="switch_mode('tabel')">
																					<div id="btn-tabel" class="border-end px-3 py-2 bg-primary fw-bold text-white">Tabel</div>
																				</button>
																				<button class="bg-transparent border-0 p-0 m-0" onclick="switch_mode('peta')">
																					<div id="btn-peta" class="px-3 py-2">Peta</div>
																				</button>
																			</div>
																		</div>
																	</div>
																</div>
																<div class="card-body">
																	<div id="map_data" class="d-none">
																		<div id="map"></div>
																	</div>
																	<div class="table-responsive gy-3" id="tabel_data">
																		<table class="table table-bordered">
																			<thead>
																				<tr>
																					<th class="text-center" style="vertical-align: middle;" rowspan="2">Nomor Prisma</th>
																					<th class="text-center" style="vertical-align: middle;" rowspan="2">Nama Prisma</th>
																					<th class="text-center" colspan="6">Awal Pengukuran</th>
																					<th class="text-center" colspan="6">Hasil Pengukuran</th>
																					<th class="text-center" colspan="4">Pergeseran</th>
																					<th class="text-center" style="vertical-align: middle;" rowspan="2">Arah Pergeseran</th>
																				</tr>
																				<tr>
																					<th class="text-center">X</th>
																					<th class="text-center">Y</th>
																					<th class="text-center">Z</th>
																					<th class="text-center">HA</th>
																					<th class="text-center">VA</th>
																					<th class="text-center">Slop Distance</th>
																					<th class="text-center">X</th>
																					<th class="text-center">Y</th>
																					<th class="text-center">Z</th>
																					<th class="text-center">HA</th>
																					<th class="text-center">VA</th>
																					<th class="text-center">Slop Distance</th>
																					<th class="text-center">ΔX</th>
																					<th class="text-center">ΔY</th>
																					<th class="text-center">ΔZ</th>
																					<th class="text-center">Linier</th>
																				</tr>
																			</thead>
																			<tbody>
																				<?php foreach (
																					$log['temp_prisma'] as $key => $pr
																				): ?>
																					<?php if (isset($pr['temp_tembak']['nama_prisma'])) { ?>
																						<tr>
																							<td class="text-center"><?= $key += 1 ?></td>
																							<td><a href="<?= base_url() ?>adr/set_sensordash?tabel=rts&id_prisma=<?= $pr['id_prisma'] ?>"><?= str_replace('_', ' ', $pr['temp_tembak']['nama_prisma']) ?></a></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['E0'] != '0') ? $pr['temp_tembak']['E0'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak']  and $pr['temp_tembak']['N0'] != '0') ? $pr['temp_tembak']['N0'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['Z0'] != '0') ? $pr['temp_tembak']['Z0'] : '-' ?></td>

																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['HA0'] != '000,00,00') ? $pr['temp_tembak']['HA0'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['VA0'] != '000,00,00') ? $pr['temp_tembak']['VA0'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['SD0'] != '0') ? $pr['temp_tembak']['SD0'] : '-' ?></td>

																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['E1'] != '0') ? $pr['temp_tembak']['E1'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['N1'] != '0') ? $pr['temp_tembak']['N1'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['Z1'] != '0') ? $pr['temp_tembak']['Z1'] : '-' ?></td>

																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['HA1'] != '000,00,00') ? $pr['temp_tembak']['HA1'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['VA1'] != '000,00,00') ? $pr['temp_tembak']['VA1'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak'] and $pr['temp_tembak']['SD1'] != '0') ? $pr['temp_tembak']['SD1'] : '-' ?></td>

																							<td class="text-center"><?= ($pr['temp_tembak']) ? $pr['temp_tembak']['DN'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak']) ? $pr['temp_tembak']['DE'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak']) ? $pr['temp_tembak']['DZ'] : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak']) ? number_format($pr['temp_tembak']['linear'], '2', '.', '') : '-' ?></td>
																							<td class="text-center"><?= ($pr['temp_tembak']) ? $pr['temp_tembak']['arah_pergeseran'] : '-' ?></td>
																						</tr>
																					<?php } ?>

																				<?php endforeach ?>
																			</tbody>
																		</table>
																	</div>
																</div>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									<?php } ?>
								</div>
							</div>
						</div>
					</div>
				<?php } else { ?>
					<div class="col-lg-6">
						<div class="card">
							<div class="card-header">
								<h3 class="card-title"><strong><?= $kt['nama_kategori'] ?>
									</strong> <?= ($kt['kepanjangan']) ? '(' . $kt['kepanjangan'] . ')' : '' ?></h3>
							</div>
							<div class="card-body">
								<div class="row row-cards">
									<?php foreach ($kt['logger'] as $log) { ?>
										<div class="col-12">
											<div class="card">
												<div class="card-status-top bg-<?= $log['color'] ?>"></div>
												<div class="ribbon bg-<?= $log['color'] ?>"> <?= $log['waktu'] ?>
													<div class="card-actions">
														<div class="dropdown">
															<a href="#" class="btn-icon" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
																<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-list" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="white" fill="none" stroke-linecap="round" stroke-linejoin="round">
																	<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
																	<line x1="9" y1="6" x2="20" y2="6"></line>
																	<line x1="9" y1="12" x2="20" y2="12"></line>
																	<line x1="9" y1="18" x2="20" y2="18"></line>
																	<line x1="5" y1="6" x2="5" y2="6.01"></line>
																	<line x1="5" y1="12" x2="5" y2="12.01"></line>
																	<line x1="5" y1="18" x2="5" y2="18.01"></line>
																</svg>
															</a>
															<div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
																<div class="dropdown-item">
																	<strong><a href="#" class="text-reset">Id Logger</a></strong>
																	<label class="form-check m-0 ms-auto">
																		<?= $log['id_logger'] ?>
																	</label>
																</div>
																<div class="dropdown-item">
																	<strong><a href="#" class="text-reset">Status Logger</a></strong>
																	<label class="form-check m-0 ms-auto">
																		<?= $log['status_logger'] ?>
																	</label>
																</div>
																<div class="dropdown-item">
																	<strong><a href="#" class="text-reset">Status SD Card</a></strong>
																	<label class="form-check m-0 ms-auto">
																		<?= $log['status_sd'] ?>
																	</label>
																</div>
															</div>
														</div>
													</div>
												</div>
												<div class="card-header py-3 d-flex align-items-center justify-content-between">
													<h3 class="card-title me-3"><?= $log['nama_lokasi'] ?></h3>
												</div>
												<div class="card-body p-0">
													<div class="table-responsive">
														<table class="table table-vcenter card-table">
															<thead>
																<tr>
																	<th>Parameter</th>
																	<th>Nilai Ukur</th>
																</tr>
															</thead>
															<tbody>
																<?php foreach ($log['param'] as $val) { ?>
																	<tr>
																		<td>
																			<a href="<?= (isset($val['link'])) ? $val['link'] : '' ?>">
																				<?= str_replace('_', ' ', $val['nama_parameter']) ?>
																			</a>

																		</td>
																		<td>
																			<?= $val['nilai'] ?> <?= ($val['nilai'] != '-') ? $val['satuan'] : '' ?>
																		</td>
																	</tr>
																<?php } ?>
																<tr>
																</tr>
															</tbody>
														</table>
													</div>
												</div>
											</div>
										</div>
									<?php } ?>
								</div>
							</div>
						</div>
					</div>
				<?php } ?>
			<?php } ?>
		</div>
	</div>
</div>
<script>
	const location_new = <?php echo json_encode($marker) ?>;

	var site = "<?= $this->session->userdata('temp_kontrol')->site ?>";
	var lat = "3.6307977846194737";
	var lon = "117.23368934932883";

	if (site == 'viewpoint') {
		lat = "3.6444116043375363";
		lon = "117.24226908676536";
	}

	const extendLine = (p1, p2, extendFactor = 10) => {
		return [
			p1[0] + (p2[0] - p1[0]) * extendFactor,
			p1[1] + (p2[1] - p1[1]) * extendFactor
		];
	};

	console.log('polylineDecorator', typeof L.polylineDecorator);
	console.log('Symbol', L.Symbol);

	function initLeafletMap() {
		const zoom = site == 'ccp' ? 18 : 15;

		const map = L.map('map', {
			zoomControl: true
		}).setView([parseFloat(lat), parseFloat(lon)], zoom);

		const road = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 20,
			attribution: '&copy; OpenStreetMap'
		});

		const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
			maxZoom: 20,
			attribution: 'Tiles &copy; Esri'
		});

		road.addTo(map);

		const baseLayers = {
			'Road': road,
			'Satellite': satellite
		};
		L.control.layers(baseLayers, null, {
			position: 'topright'
		}).addTo(map);

		let activeBase = 'Road';
		map.on('baselayerchange', (e) => {
			activeBase = e.name;
			updateAllLabels();
		});

		let currentPopupMarker = null;
		const allR0 = [];
		const markersWithMeta = [];

		L.marker([parseFloat(lat), parseFloat(lon)], {
			icon: L.icon({
				iconUrl: 'https://ciawi.monitoring4system.com/pin_marker/baru/adr_on.png',
				iconSize: [25, 33],
				iconAnchor: [12, 33]
			})
		}).addTo(map);

		const labelClass = () => (activeBase === 'Satellite' ? 'label-sat' : 'label-road');

		const bindOrUnbindLabel = (m, text) => {
			const z = map.getZoom();
			if (z >= 14) {
				if (!m.getTooltip()) {
					m.bindTooltip(text, {
						permanent: true,
						direction: 'top',
						className: labelClass(),
						offset: [0, -6]
					});
				} else {
					m.setTooltipContent(text);
					if (m.getTooltip()?.options) m.getTooltip().options.className = labelClass();
					m.openTooltip();
				}
			} else {
				if (m.getTooltip()) m.unbindTooltip();
			}
		};

		const updateAllLabels = () => {
			markersWithMeta.forEach(({
				marker,
				label
			}) => bindOrUnbindLabel(marker, label));
		};

		map.on('zoomend', updateAllLabels);

		location_new.forEach((location) => {
			const start = [
				parseFloat(location['latitude_conv']),
				parseFloat(location['longitude_conv'])
			];

			const end = [
				parseFloat(location['latitude_new']),
				parseFloat(location['longitude_new'])
			];

			const hasStart = !isNaN(start[0]) && !isNaN(start[1]);
			if (hasStart) {
				allR0.push(start);
			}

			const hasNew = !isNaN(end[0]) && !isNaN(end[1]) && end[0] !== 0 && end[1] !== 0;

			const iconUrl = hasNew ?
				'https://ciawi.monitoring4system.com/pin_marker/prisma_success.png' :
				'https://ciawi.monitoring4system.com/pin_marker/prisma_failed.png';

			const marker = L.marker(start, {
				icon: L.icon({
					iconUrl,
					iconSize: [24, 24],
					iconAnchor: [12, 12]
				})
			}).addTo(map);

			const title = (location['title'] || '').toString().replace('_', ' ');
			markersWithMeta.push({
				marker,
				label: title
			});

			const popupHtml = `
        <div class="d-flex justify-content-start mt-2 w-100">
          <h3 class="pt-1 mb-0"><strong>${title}</strong></h3>
        </div>
        <table class="table table-bordered mt-3 rounded">
          <tbody>
            <tr><td>ΔX</td><td>${hasNew ? location['deltaX'] : '0 (Failed)'}</td></tr>
            <tr><td>ΔY</td><td>${hasNew ? location['deltaY'] : '0 (Failed)'}</td></tr>
            <tr><td>ΔZ</td><td>${hasNew ? location['deltaZ'] : '0 (Failed)'}</td></tr>
            <tr><td>Slop Distance</td><td>${hasNew ? location['sdis'] : '0 (Failed)'}</td></tr>
          </tbody>
        </table>
      `;
			marker.bindPopup(popupHtml);

			marker.on('click', () => {
				if (currentPopupMarker && currentPopupMarker !== marker) {
					currentPopupMarker.closePopup();
				}
				currentPopupMarker = marker;
				map.panTo(marker.getLatLng());
				marker.openPopup();
			});

			if (hasNew) {
				const extendedEnd = extendLine(start, end, 10);

				const mainLine = L.polyline([start, extendedEnd], {
					color: '#007bff',
					weight: 1,
					opacity: 1
				}).addTo(map);

				const line = L.polyline([start, extendedEnd], {
					color: '#007bff',
					weight: 1,
					opacity: 1
				}).addTo(map)

				L.polylineDecorator(line, {
					patterns: [{
						offset: '100%',
						repeat: 0,
						symbol: L.Symbol.arrowHead({
							pixelSize: 10,
							polygon: true,
							pathOptions: {
								color: '#007bff',
								weight: 2,
								fillOpacity: 1
							}
						})
					}]
				}).addTo(map)

			}

			bindOrUnbindLabel(marker, title);
		});

		if (allR0.length > 1) {
			L.polyline(allR0, {
				color: '#D1D3D4',
				weight: 0.5,
				opacity: 1,
				dashArray: '2,6'
			}).addTo(map);
		}

		updateAllLabels();
	}

	document.addEventListener('DOMContentLoaded', function() {
		initLeafletMap();
	});
</script>
<script>
	function switch_mode(mode) {
		if (mode == 'tabel') {
			$('#map_data').addClass('d-none');
			$('#tabel_data').removeClass('d-none');

			$('#btn-tabel').addClass('bg-primary fw-bold text-white');
			$('#btn-peta').removeClass('bg-primary fw-bold text-white');
		} else {
			$('#map_data').removeClass('d-none');
			$('#tabel_data').addClass('d-none');

			$('#btn-peta').addClass('bg-primary fw-bold text-white');
			$('#btn-tabel').removeClass('bg-primary fw-bold text-white');
		}
	}
	document.addEventListener("DOMContentLoaded", function() {
		var el;
		window.TomSelect && (new TomSelect(el = document.getElementById('pilih_kategori'), {
			copyClassesToDropdown: false,
			dropdownClass: 'dropdown-menu ts-dropdown',
			optionClass: 'dropdown-item',
			controlInput: '<input>',
			render: {
				item: function(data, escape) {
					if (data.customProperties) {
						return '<div><span class="dropdown-item-indicator">' + data.customProperties + '</span>' + escape(data.text) + '</div>';
					}
					return '<div>' + escape(data.text) + '</div>';
				},
				option: function(data, escape) {
					if (data.customProperties) {
						return '<div><span class="dropdown-item-indicator">' + data.customProperties + '</span>' + escape(data.text) + '</div>';
					}
					return '<div>' + escape(data.text) + '</div>';
				},
			},
		}));
		window.TomSelect && (new TomSelect(el = document.getElementById('pilih_interval'), {

		}));
	});
</script>
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script>
	$(function() {
		const $items = $('#logList .list-group-item');
		const $pager = $('#logPager');
		const perPage = 15;
		const total = $items.length;
		const totalPages = Math.max(1, Math.ceil(total / perPage));
		let current = 1;

		if (total === 0) {
			$pager.hide();
			return;
		}

		function showPage(page) {
			current = Math.min(Math.max(1, page), totalPages);
			const start = (current - 1) * perPage;
			const end = start + perPage;

			$items.hide().slice(start, end).show();

			$pager.find('li').removeClass('active disabled');
			$pager.find('li[data-page="' + current + '"]').addClass('active');
			if (current === 1) $pager.find('li[data-role="prev"]').addClass('disabled');
			if (current === totalPages) $pager.find('li[data-role="next"]').addClass('disabled');
			$items.hide().removeClass('page-first page-last')
				.slice(start, end).show();


			$items.slice(start, end).first().addClass('page-first');
			$items.slice(start, end).last().addClass('page-last');

			if (start > 0) $first.addClass('with-top-border');

		}

		function renderPager() {
			$pager.empty();
			$pager.append($('<li/>', {
				class: 'page-item',
				'data-role': 'prev'
			}).append($('<a/>', {
				href: '#',
				class: 'page-link',
				html: svgLeft()
			})));
			for (let i = 1; i <= totalPages; i++) {
				$pager.append($('<li/>', {
					class: 'page-item',
					'data-page': i
				}).append($('<a/>', {
					href: '#',
					class: 'page-link',
					text: i
				})));
			}
			$pager.append($('<li/>', {
				class: 'page-item',
				'data-role': 'next'
			}).append($('<a/>', {
				href: '#',
				class: 'page-link',
				html: svgRight()
			})));

			$pager.off('click').on('click', 'a.page-link', function(e) {
				e.preventDefault();
				const $li = $(this).closest('li');
				if ($li.hasClass('disabled') || $li.hasClass('active')) return;
				if ($li.data('role') === 'prev') showPage(current - 1);
				else if ($li.data('role') === 'next') showPage(current + 1);
				else showPage(parseInt($li.data('page'), 10));
				document.getElementById('logList')?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
			});
		}

		function svgLeft() {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ' +
				'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
				'stroke-linecap="round" stroke-linejoin="round" class="icon icon-1">' +
				'<path d="M15 6l-6 6l6 6"></path></svg>';
		}

		function svgRight() {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ' +
				'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
				'stroke-linecap="round" stroke-linejoin="round" class="icon icon-1">' +
				'<path d="M9 6l6 6l-6 6"></path></svg>';
		}
		renderPager();
		const $active = $items.filter('.active').first();
		if ($active.length) {
			const idx = $items.index($active);
			const pageOfActive = Math.ceil((idx + 1) / perPage);
			showPage(pageOfActive);
			setTimeout(() => {
				$active[0].scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
			}, 0);
		} else {
			showPage(1);
		}
	});
</script>