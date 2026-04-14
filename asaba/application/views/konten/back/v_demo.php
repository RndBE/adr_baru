<style>
	.hide-scrollbar::-webkit-scrollbar {
		display: none;
	}

	.gm-style-iw-chr {
		position: absolute;
		right: 0px
	}

	#map {
		height: 600px;
		width: 100%;
	}

	.list-group-item-action:hover {
		background-color: #f0f2f3
	}

	.sparkline {
		width: 220px !important;
		height: 60px !important;
	}

	.legend-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 999px;
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
		/* samakan dengan warna border Bootstrap */
	}
</style>
<div class="container-xl mb-0">
	<!-- Page title -->
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
	<!-- Konten-->
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
																			<div class="d-flex rounded border me-3" style="overflow:hidden">
																				<button class="bg-transparent border-0 p-0 m-0" onclick="switch_view('event')">
																					<div id="btn-event" class="border-end px-3 py-2 bg-primary fw-bold text-white">Event</div>
																				</button>
																				<button class="bg-transparent border-0 p-0 m-0" onclick="switch_view('harian')">
																					<div id="btn-harian" class="px-3 py-2">Harian</div>
																				</button>
																			</div>
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
																	<div id="event_section">
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
																	<div id="harian_section" class="d-none">
																		<div class="table-responsive">
																			<table class="table table-bordered">
																				<thead>
																					<tr>
																						<th class="text-center">No</th>
																						<th>Nama Prisma</th>
																						<th class="text-center">Pergeseran (mm)</th>
																						<th class="text-center">Status Pergeseran</th>
																						<th class="text-center">Kecepatan (mm/hari)</th>
																						<th class="text-center">Status Kecepatan</th>
																						<th class="text-center">Grafik</th>
																						<th class="text-center">Waktu Awal</th>
																						<th class="text-center">Waktu Akhir</th>
																					</tr>
																				</thead>
																				<tbody>
																					<?php foreach ($log['temp_prisma'] as $key => $pr): ?>
																						<?php $d = isset($pr['daily']) ? $pr['daily'] : null; ?>
																						<tr>
																							<td class="text-center"><?= $key += 1 ?></td>
																							<td><?= isset($pr['temp_tembak']['nama_prisma']) ? str_replace('_', ' ', $pr['temp_tembak']['nama_prisma']) : ($pr['nama_prisma'] ?? '-') ?></td>
																							<td class="text-center"><?= ($d && $d['pergeseran_mm'] !== null) ? number_format($d['pergeseran_mm'], 2, '.', '') : '-' ?></td>
																							<td class="text-center">
																								<?php if ($d && $d['status_pergeseran']) { ?>
																									<span class="badge <?= $d['status_pergeseran']['class'] ?>"><?= $d['status_pergeseran']['label'] ?></span>
																								<?php } else {
																									echo '-';
																								} ?>
																							</td>
																							<td class="text-center"><?= ($d && $d['kecepatan_mmd'] !== null) ? number_format($d['kecepatan_mmd'], 2, '.', '') : '-' ?></td>
																							<td class="text-center">
																								<?php if ($d && $d['status_kecepatan']) { ?>
																									<span class="badge <?= $d['status_kecepatan']['class'] ?>"><?= $d['status_kecepatan']['label'] ?></span>
																								<?php } else {
																									echo '-';
																								} ?>
																							</td>
																							<td class="text-center px-0  d-flex flex-column align-items-center" style="min-width:220px">
																								<?php if ($d && !empty($d['series'])) { ?>
																									<?php
																									$site = $this->session->userdata('temp_kontrol')->site ?? 'vp';
																									$thr = ($site === 'ccp')
																										? ['n1' => 100, 'n2' => 200, 'n3' => 400]
																										: ['n1' => 50, 'n2' => 100, 'n3' => 200];
																									?>
																									<canvas class="sparkline" height="60" data-thresholds='<?= json_encode($thr, JSON_HEX_APOS | JSON_HEX_QUOT) ?>' data-series='<?= json_encode($d["series"], JSON_HEX_APOS | JSON_HEX_QUOT) ?>'></canvas>
																									<div class="d-flex justify-content-center mt-2 gap-2 small text-muted">
																										<span><span class="legend-dot" style="background:#16a34a"></span> Normal</span>
																										<span><span class="legend-dot" style="background:#f59e0b"></span> Waspada</span>
																										<span><span class="legend-dot" style="background:#f97316"></span> Siaga</span>
																										<span><span class="legend-dot" style="background:#ef4444"></span> Awas</span>
																									</div>
																								<?php } else {
																									echo '-';
																								} ?>
																							</td>
																							<td class="text-center"><?= ($d && $d['first_time']) ? $d['first_time'] : '-' ?></td>
																							<td class="text-center"><?= ($d && $d['last_time']) ? $d['last_time'] : '-' ?></td>
																						</tr>
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
	<!-- end Konten-->
</div>

<script
	src="https://maps.googleapis.com/maps/api/js?key=AIzaSyA0za7gSm6K-8eFKK-np3jhyyW5IMRVSb8"
	async
	defer></script>
<script>
	const location_new = <?php echo json_encode($marker) ?>;
	var site = "<?= $this->session->userdata('temp_kontrol')->site ?>";
	var lat = "3.6307977846194737";
	var lon = "117.23368934932883";

	if (site == 'viewpoint') {
		lat = "3.6444116043375363";
		lon = "117.24226908676536";
	}

	function initMap() {


		const map = new google.maps.Map(document.getElementById("map"), {
			center: {
				lat: parseFloat(lat),
				lng: parseFloat(lon)
			},
			zoom: site == 'ccp' ? 18 : 15,
			disableDefaultUI: false,
		});

		let currentInfoWindow = null;
		const allR0 = [];

		// Marker utama ADR
		new google.maps.Marker({
			position: {
				lat: parseFloat(lat),
				lng: parseFloat(lon)
			},
			map: map,
			icon: {
				url: 'https://ciawi.monitoring4system.com/pin_marker/baru/adr_on.png',
				scaledSize: new google.maps.Size(25, 33),
			},
		});

		// Fungsi perpanjang garis
		const extendLine = (p1, p2, extendFactor = 39) => {
			return {
				lat: p1.lat + (p2.lat - p1.lat) * extendFactor,
				lng: p1.lng + (p2.lng - p1.lng) * extendFactor
			};
		};

		location_new.forEach((location) => {
			const start = {
				loc: location['title'],
				lat_conv: parseFloat(location['latitude_r0']),
				lng_conv: parseFloat(location['longitude_r0']),
				lat: parseFloat(location['latitude_conv']),
				lng: parseFloat(location['longitude_conv'])
			};

			const end = {
				lat: parseFloat(location['latitude_new']),
				lng: parseFloat(location['longitude_new'])
			};
			console.log(start);
			if (!isNaN(start.lat) && !isNaN(start.lng)) allR0.push(start);
			const extendedEnd = extendLine(start, end, 10);

			const hasNew = !isNaN(end.lat) && !isNaN(end.lng) && end.lat !== 0 && end.lng !== 0;
			const iconUrl = hasNew ?
				'https://ciawi.monitoring4system.com/pin_marker/prisma_success.png' :
				'https://ciawi.monitoring4system.com/pin_marker/prisma_failed.png';

			// Buat marker
			const marker = new google.maps.Marker({
				position: start,
				map: map,
				icon: {
					url: iconUrl,
					anchor: new google.maps.Point(12, 12),
					scaledSize: new google.maps.Size(24, 24),
					labelOrigin: new google.maps.Point(12, -6),
				}
			});

			// Jika data valid → buat garis + panah
			if (hasNew) {
				const mainLine = new google.maps.Polyline({
					path: [start, extendedEnd],
					map: map,
					strokeColor: "#007bff",
					strokeOpacity: 1.0,
					strokeWeight: 1,
				});

				const arrowSymbol = {
					path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
					scale: 3,
					strokeColor: "#007bff",
					strokeWeight: 2,
					fillColor: "#007bff",
					fillOpacity: 1,
				};

				new google.maps.Polyline({
					path: [start, extendedEnd],
					map: map,
					strokeOpacity: 0,
					icons: [{
						icon: arrowSymbol,
						offset: "100%"
					}],
				});
			}

			// Buat InfoWindow
			const infoWindow = new google.maps.InfoWindow({
				content: `
				<div class="d-flex justify-content-start mt-2 w-100">
					<h3 class="pt-1 mb-0"><strong>${location['title'].replace('_',' ')}</strong></h3>
	</div>
				<table class="table table-bordered mt-3 rounded">
					<tbody>
						<tr><td>ΔX</td><td>${hasNew ? location['deltaX'] : '0 (Failed)'}</td></tr>
						<tr><td>ΔY</td><td>${hasNew ? location['deltaY'] : '0 (Failed)'}</td></tr>
						<tr><td>ΔZ</td><td>${hasNew ? location['deltaZ'] : '0 (Failed)'}</td></tr>
						<tr><td>Slop Distance</td><td>${hasNew ? location['sdis'] : '0 (Failed)'}</td></tr>
	</tbody>
	</table>`
			});

			// Label zoom
			const updateLabels = () => {
				const zoomLevel = map.getZoom();
				const isSatellite = map.getMapTypeId() === "satellite" || map.getMapTypeId() === "hybrid";
				if (zoomLevel >= 14) {
					marker.setLabel({
						text: location['title'].replace('_', ' '),
						fontSize: "14px",
						fontWeight: "bold",
						color: isSatellite ? "white" : "black",
					});
				} else {
					marker.setLabel(null);
				}
			};

			map.addListener("zoom_changed", updateLabels);
			map.addListener("maptypeid_changed", updateLabels);
			updateLabels();

			// Klik marker → buka InfoWindow
			marker.addListener("click", () => {
				if (currentInfoWindow) currentInfoWindow.close();
				map.panTo(marker.getPosition());
				infoWindow.open(map, marker);
				currentInfoWindow = infoWindow;
			});
		});

		// Garis penghubung antar semua R0
		if (allR0.length > 1) {
			new google.maps.Polyline({
				path: allR0,
				map: map,
				strokeColor: "#D1D3D4",
				strokeOpacity: 1.0,
				strokeWeight: 0.5,
				icons: [{
					icon: {
						path: "M 0,-1 0,1",
						strokeOpacity: 1,
						scale: 2
					},
					offset: "0",
					repeat: "10px"
				}]
			});
		}
	}
	if (typeof google !== 'undefined' && google.maps) {
		initMap();
	} else {
		window.onload = initMap;
	}

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

	function switch_view(view) {
		if (view == 'event') {
			$('#event_section').removeClass('d-none');
			$('#harian_section').addClass('d-none');
			$('#btn-event').addClass('bg-primary fw-bold text-white');
			$('#btn-harian').removeClass('bg-primary fw-bold text-white');
			switch_mode('tabel');
		} else {
			$('#event_section').addClass('d-none');
			$('#harian_section').removeClass('d-none');
			$('#btn-harian').addClass('bg-primary fw-bold text-white');
			$('#btn-event').removeClass('bg-primary fw-bold text-white');
			$('#map_data').addClass('d-none');
			$('#tabel_data').removeClass('d-none');
		}
	}
	// @formatter:off
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


	// @formatter:on
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script>
	function mmToColor(mm, thr) {
		const n1 = thr && Number.isFinite(Number(thr.n1)) ? Number(thr.n1) : 50;
		const n2 = thr && Number.isFinite(Number(thr.n2)) ? Number(thr.n2) : 100;
		const n3 = thr && Number.isFinite(Number(thr.n3)) ? Number(thr.n3) : 200;
		if (mm < n1) return "#16a34a";
		if (mm < n2) return "#f59e0b";
		if (mm < n3) return "#f97316";
		return "#ef4444";
	}

	function initSparklines() {
		const list = document.querySelectorAll('canvas.sparkline');
		list.forEach((canvas) => {
			const raw = canvas.getAttribute('data-series');
			if (!raw) return;
			let series = [];
			try {
				series = JSON.parse(raw) || [];
			} catch (e) {
				series = [];
			}
			if (!series.length) return;

			let thr = null;
			const thrRaw = canvas.getAttribute('data-thresholds');
			if (thrRaw) {
				try {
					thr = JSON.parse(thrRaw);
				} catch (e) {
					thr = null;
				}
			}

			canvas.width = 220;
			canvas.height = 60;

			const labels = series.map(p => p.t);
			const data = series.map(p => Number(p.mm));
			const colors = series.map(p => mmToColor(Number(p.mm), thr));

			new Chart(canvas.getContext('2d'), {
				type: 'line',
				data: {
					labels,
					datasets: [{
						data,
						borderColor: '#2563eb',
						borderWidth: 1,
						backgroundColor: 'rgba(37,99,235,0.12)',
						pointBackgroundColor: colors,
						pointRadius: 3,
						pointHoverRadius: 4,
						tension: 0.35,
						fill: true
					}]
				},
				options: {
					responsive: false,
					maintainAspectRatio: false,
					animation: false,
					plugins: {
						legend: {
							display: false
						},
						tooltip: {
							enabled: true
						}
					},
					scales: {
						x: {
							display: false
						},
						y: {
							display: false
						}
					}
				}
			});
		});
	}

	// butuhkan jQuery

	$(function() {
		const $items = $('#logList .list-group-item');
		const $pager = $('#logPager');
		const perPage = 15; // sesuaikan
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

			// Tambah class untuk item paling atas & bawah di halaman ini
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

		// --- INISIALISASI ---
		renderPager();
		initSparklines();

		// Cari item active (dari PHP session class 'active ...')
		const $active = $items.filter('.active').first();
		if ($active.length) {
			const idx = $items.index($active); // 0-based
			const pageOfActive = Math.ceil((idx + 1) / perPage);
			showPage(pageOfActive);

			// Scroll halus ke item aktif (setelah halaman tampil)
			setTimeout(() => {
				$active[0].scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
			}, 0);
		} else {
			// fallback ke halaman 1 jika tidak ada yang active
			showPage(1);
		}
	});
</script>