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
	<div class="page-header d-print-none">
		<div class="row g-3 align-items-center">
			<div class="col-auto">

				<?php
				echo anchor('beranda', '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-big-left-lines" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
			<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
			<path d="M12 15v3.586a1 1 0 0 1 -1.707 .707l-6.586 -6.586a1 1 0 0 1 0 -1.414l6.586 -6.586a1 1 0 0 1 1.707 .707v3.586h3v6h-3z"></path>
			<path d="M21 15v-6"></path>
			<path d="M18 15v-6"></path>
		</svg>
') ?>

			</div>
			<div class="col-auto">
				<span class="status-indicator status-<?= ($status_logger) ? 'green' : 'dark' ?> status-indicator-animated">
					<span class="status-indicator-circle"></span>
					<span class="status-indicator-circle"></span>
					<span class="status-indicator-circle"></span>
				</span>
			</div>
			<div class="col col-md-auto">
				<h2 class="page-title mb-1">
					<?= $info_logger->nama_lokasi ?>

				</h2>
				<div class="text-muted">
					<ul class="list-inline list-inline-dots mb-0">

						<li class="list-inline-item"><span class="text-<?= ($status_logger) ? 'green' : 'black' ?>"><?= ($status_logger) ? 'Koneksi Terhubung' : 'Koneksi Terputus' ?> </span></li>

					</ul>
				</div>
			</div>


			<div class="col-auto col-md ">

			</div>
			<div class="col-auto d-flex">
				<a class="btn border-danger me-2 btn-kontrol text-danger <?= ($status_kontrol->status_manual == '0') ? 'd-none': '' ?>  " role="button">
					<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-alert-square-rounded text-danger" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
						<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
						<path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z"></path>
						<path d="M12 8v4"></path>
						<path d="M12 16h.01"></path>
					</svg>
					RTS Sedang Beroperasi
				</a>
				<button class="btn  btn-outline-secondary  bg-white me-2 text-dark" data-bs-toggle="modal" data-bs-target="#modalAddJob">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2 icon icon-tabler icons-tabler-outline icon-tabler-adjustments-cog"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M6 4v4" /><path d="M6 12v8" /><path d="M13.199 14.399a2 2 0 1 0 -1.199 3.601" /><path d="M12 4v10" /><path d="M12 18v2" /><path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M18 4v1" /><path d="M18 9v2.5" /><path d="M19.001 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M19.001 15.5v1.5" /><path d="M19.001 21v1.5" /><path d="M22.032 17.25l-1.299 .75" /><path d="M17.27 20l-1.3 .75" /><path d="M15.97 17.25l1.3 .75" /><path d="M20.733 20l1.3 .75" /></svg>
					RTS Config 
				</button>

				<button class="btn w-100 border-secondary btn-kontrol text-secondary text-dark " role="button" data-bs-toggle="modal" data-bs-target="#kontrol_jadwal"> 
					<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-clock-hour-4"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12l3 2" /><path d="M12 7v5" /></svg>
					Jadwal Kontrol 
				</button>
			</div>
		</div>
	</div>
</div>

<div class="page-body">
	<div class="container-xl">
		<div class="card border-0 shadow-sm mb-3">
			<div class="card-header py-1">
				<ul class="nav nav-tabs card-header-tabs" data-bs-toggle="tabs">
					<li class="nav-item">
						<a href="#tabs-structural" class="nav-link active fw-bold" data-bs-toggle="tab">
							<i class="fa-solid fa-layer-group me-2"></i> Structural Health
						</a>
					</li>
					<li class="nav-item">
						<a href="#tabs-device" class="nav-link fw-bold" data-bs-toggle="tab">
							<i class="fa-solid fa-server me-2"></i> Device Health & Audit Log
						</a>
					</li>
				</ul>
			</div>
			<div class="card-body p-3">
				<div class="tab-content">
					<!-- TAB 1: STRUCTURAL HEALTH -->
					<div class="tab-pane active show" id="tabs-structural">
						<div class="row gy-3">
							<div class="col-lg-4 col-xl-4 col-xxl-3">
				<div class="card">
					<div class="card-header d-flex justify-content-between">
						<h3 class="card-title fw-bold">Kontrol ADR</h3>
						<h4 class="fw-normal mb-0"><?= $waktu ?></h4>
					</div>
					<div class="card-body">
						<div class="row gy-3 gx-3 mb-4">
							<div class="col-xl-6">
								<div class=" border rounded py-2 d-flex flex-column justify-content-center align-items-center">
									<h4 class="fw-normal mb-1">Status RTS : </h4>
									<h4 class="mb-0">

										<?php if($data_rts['Cek_RTS']['nilai'] =='1'){?>
										Connected - <span id="sts_rts"><?= ($data_rts['RTS_Running']['nilai'] =='1') ?'Running':'Standby' ?></span>
										<?php } else{ ?>
										Disconnected
										<?php } ?>
									</h4>
								</div>
							</div>
							<div class="col-xl-6">
								<div class=" border rounded py-2 d-flex flex-column justify-content-center align-items-center">
									<h4 class="fw-normal mb-1">Slop Distance : </h4>
									<h4 class="mb-0"><?= $data_rts['SDis']['nilai'] ?>
									</h4>
								</div>
							</div>
							<div class="col-xl-6">
								<div class=" border rounded py-2 d-flex flex-column justify-content-center align-items-center">
									<h4 class="fw-normal mb-1">Vertical Angle : </h4>
									<h4 class="mb-0"><?= $data_rts['VA']['nilai'] ?></h4>
								</div>
							</div>
							<div class="col-xl-6">
								<div class=" border rounded py-2 d-flex flex-column justify-content-center align-items-center">
									<h4 class="fw-normal mb-1">Horizontal Angle : </h4>
									<h4 class="mb-0"><?= $data_rts['HA']['nilai'] ?></h4>
								</div>
							</div>

						</div>
						<label class="mb-2">Kode Akses :</label>
						<div class="d-flex">
							<input class="form-control w-100 me-3" type="text" id="kode_akses"/ <?= ($status_kontrol->status_manual == '1') ? 'disabled': '' ?>>
							<button class="btn btn-primary " type="button" id="submit_kontrol" <?= ($status_kontrol->status_manual == '1' or $data_rts['Cek_RTS']['nilai'] =='0') ? 'disabled': '' ?>><i id="load1" class="fa-solid fa-spinner fa-spin me-2 d-none"></i>Mulai Kontrol</button></div>
						<small class="text-danger d-none" id="kode_salah">*Kode Akses Salah</small>
					</div>
				</div>
			</div>
			<div class="col-lg-8 col-xl-8 col-xxl-9">
				<div class="card">
					<div class="card-header d-flex justify-content-between">
						<h3 class="card-title fw-bold">Prisma Data</h3>
					</div>
					<div class="card-body">
						<div class="card">
							<div class="card-header d-flex justify-content-end py-2">
								<?php $prisma_count = ($log_kontrol) ? str_replace('P','', $log_kontrol[0]['prisma'] ) : 0; ?>
								<i>Running Date : <span id="last_running"><?= ($log_kontrol) ? $log_kontrol[0]['datetime']:'-' ?> </span> </i>
							</div>
							<div class="card-body">
								<div class="row gy-3">
									<?php foreach($data_prisma as $k => $vl){
	$cnt = str_replace('P','',$vl['id_prisma'] );

	if($cnt <= $prisma_count){
		$sts_r = 'Success';
		$clr_r = 'success';
		if($vl['E1'] == '0' and $vl['E1'] == '0' and $vl['E1'] == '0'){
			$sts_r = 'Not Found';
			$clr_r = 'danger';
		}
	}else{
		$sts_r = 'Stopped';
		$clr_r = 'secondary';
	}

									?>
									<div class="col-md-6 col-xl-4 col-xxl-3">
										<div class="card">
											<div class="card-header d-flex justify-content-center py-2" style="position:relative">
												<b><?= str_replace('_',' ',$vl['nama_prisma']) ?> </b>

												<div id="status_run<?= $vl['id_prisma'] ?>" class="d-flex align-items-center">
													<div class="badge badge-outline <?= $vl['status_get'] != '1' ? 'd-none' :'' ?> status_run text-<?= $clr_r ?>" style="position:absolute; right:15px;font-size:11px">
														<?= $sts_r ?>
													</div>		
												</div>

											</div>

											<div class="card-body p-0">
												<div class="text-center w-100 <?= $vl['status_get'] == '1' ? 'd-none' :'' ?>" style="height:168px" id="wait_<?=  $vl['id_prisma'] ?>">
													<div class="d-flex align-items-center justify-content-center flex-column my-auto h-100">
														<i  id="load1" class="fa-solid fa-spinner fa-spin mb-2"></i>
														<i class="fw-bold mt-2 h3 text-secondary">Waiting Data ...</i>
													</div>
												</div>
												<div style="height:168px" id="data_<?=  $vl['id_prisma'] ?>" class="<?= $vl['status_get'] == '0' ? 'd-none' :'' ?>">

													<table class="table table-vcenter card-table">
														<thead>
															<tr>
																<th class="text-center">Parameter</th>
																<th class="text-center">Nilai</th>
															</tr>
														</thead>
														<tbody>


															<tr>
																<td class="text-center">Y</td>
																<td class="text-center"><span id="N1_<?= $vl['id_prisma']?>"?>
																	<?= ($cnt <= $prisma_count) ? $vl['N1']: '-' ?></span>
																</td>
															</tr>
															<tr>
																<td class="text-center">X</td>
																<td class="text-center"><span id="E1_<?= $vl['id_prisma']?>"?>
																	<?= ($cnt <= $prisma_count) ? $vl['E1']: '-' ?></span>
																</td>
															</tr>
															<tr>
																<td class="text-center">Z</td>
																<td class="text-center"><span id="Z1_<?= $vl['id_prisma']?>"?>
																	<?= ($cnt <= $prisma_count) ? $vl['Z1']: '-' ?></span>
																</td>
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
				</div>
			</div>
						</div>
					</div><!-- End Tab 1 -->

					<!-- TAB 2: DEVICE HEALTH & AUDIT -->
					<div class="tab-pane" id="tabs-device">
						<div class="row gy-3">
							<!-- Bagian Audit Log / Status History Pekerjaan -->
							<div class="col-lg-12">
								<div class="card border-0 shadow-sm">
									<div class="card-header bg-light d-flex justify-content-between py-3">
										<h3 class="card-title fw-bold"><i class="fa-solid fa-clock-rotate-left text-muted me-2"></i> Audit Trail & Job Logs</h3>
									</div>
									<div class="card-body p-0">
										<div class="table-responsive">
											<table class="table table-vcenter card-table table-striped">
												<thead>
													<tr>
														<th>Timestamp</th>
														<th>Event Type</th>
														<th>Prisma Target Count</th>
														<th>User Action</th>
														<th class="text-end">Status</th>
													</tr>
												</thead>
												<tbody>
													<?php foreach($log_kontrol as $lg => $lgk) { ?>
													<tr>
														<td><?= $lgk['datetime'] ?></td>
														<td>Routine Auto-Target</td>
														<td><?= str_replace('P','',$lgk['prisma']) ?> Prisms</td>
														<td>System Automated</td>
														<td class="text-end">
															<span class="badge bg-green-lt">Completed</span>
														</td>
													</tr>
													<?php } ?>
													<?php if(empty($log_kontrol)) { ?>
													<tr>
														<td colspan="5" class="text-center text-muted">No audit trails available.</td>
													</tr>
													<?php } ?>
												</tbody>
											</table>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div><!-- End Tab 2 -->

				</div><!-- End Tab Content -->
			</div><!-- End Card Body -->
		</div><!-- End Card Tabs Wrapper -->
	</div>
	<div class="modal fade" id="kontrol_jadwal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="exampleModalLabel">Jadwal Running RTS</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<form action="<?= base_url () ?>adr/update_schedule" method="post">
					<div class="modal-body">
						<ul class="nav nav-tabs card-header-tabs row gx-0 border rounded mb-2 " data-bs-toggle="tabs">
							<li class="nav-item col">
								<a href="#1" class="nav-link active d-flex justify-content-center" data-bs-toggle="tab">Senin</a>
							</li>
							<li class="nav-item col">
								<a href="#2" class="nav-link d-flex justify-content-center" data-bs-toggle="tab">Selasa</a>
							</li>
							<li class="nav-item col">
								<a href="#3" class="nav-link d-flex justify-content-center" data-bs-toggle="tab">Rabu</a>
							</li>
							<li class="nav-item col">
								<a href="#4" class="nav-link d-flex justify-content-center" data-bs-toggle="tab">Kamis</a>
							</li>
							<li class="nav-item col">
								<a href="#5" class="nav-link d-flex justify-content-center" data-bs-toggle="tab">Jumat</a>
							</li>
							<li class="nav-item col">
								<a href="#6" class="nav-link d-flex justify-content-center" data-bs-toggle="tab">Sabtu</a>
							</li>
							<li class="nav-item col">
								<a href="#7" class="nav-link d-flex justify-content-center" data-bs-toggle="tab">Minggu</a>
							</li>
						</ul>
						<div class="tab-content">
							<?php foreach($schedule as $ke => $sc): ?>
							<div class="tab-pane border rounded  p-2 <?= $ke == 0 ? 'active show': ''?>" id="<?= $sc['days']?>">
								<div class="text-start">
									<input type="checkbox" name="status_notif_<?= $sc['days'] ?>" data-toggle="toggle" <?= $sc['status'] ? 'checked' : ''?> id="btn_toggle_<?= $sc['days'] ?>">	
								</div>
								<div id="set_run_<?= $sc['days'] ?>" class="w-100 mt-2 <?=  $sc['status'] ? '' : 'd-none'?>">
									<div class="mb-2 w-100">
										<?php foreach($sc['sc'] as $k => $v): ?>
										<div class="d-flex justify-content-between align-items-center w-100 mb-2">
											<div class="form-check align-items-center mb-0 me-2 w-100">
												<input class="form-check-input" type="checkbox" name="<?= $v['id']?>" <?= $v['status'] == '1' ? 'checked':''?> id="c<?= $v['id']?>">
												<label class="form-check-label" for="c<?= $v['id']?>">
													<?= $v['nama']?>
												</label>
											</div>
											<input type="time" name="time_<?= $v['id'] ?>" id="i<?= $v['id']?>" class="form-control w-100 "  <?= $v['status'] == '0' ? 'disabled':''?> value="<?= $v['status'] == '0' ? '':$v['time'] ?>" />
										</div>
										<?php endforeach ?>

									</div>
								</div>
							</div>
							<?php endforeach ?>
						</div>



					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
						<button type="submit" class="btn btn-primary">Simpan</button>
					</div>
				</form>
			</div>
		</div>
	</div>
	<!-- Modal Tambah Data -->

	<div class="modal fade" id="modalAddJob" tabindex="-1" aria-labelledby="modalAddJobLabel" aria-hidden="true">
		<div class="modal-dialog modal-lg modal-dialog-centered">
			<div class="modal-content">

				<div class="modal-header text-dark">
					<h5 class="modal-title" id="modalAddJobLabel">Config ADR</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
				</div>

				<form action="<?= base_url('adr/config_adr') ?>" method="post">
					<div class="modal-body">

						<div class="row">
							<div class="col-md-6 mb-3">
								<label class="form-label">Job Name</label>
								<input type="text" name="job_name" class="form-control" value="<?= $adr['job_name']?>" required>
							</div>

							<div class="col-md-3 mb-3">
								<label class="form-label">Prisma Const</label>
								<input type="number" name="prisma_const" class="form-control" value="<?= $adr['prisma_cons']?>" required>
							</div>

							<div class="col-md-3 mb-3">
								<label class="form-label">TS High</label>
								<input type="text" name="ts_high" class="form-control" value="<?= $adr['ts_high']?>" required>
							</div>

							<div class="col-md-4 mb-3">
								<label class="form-label">Coordinate X</label>
								<input type="text" id="coor_x" name="coor_x" class="form-control"  value="<?= $adr['coor_x']?>" required>
							</div>

							<div class="col-md-4 mb-3">
								<label class="form-label">Coordinate Y</label>
								<input type="text"  id="coor_y" name="coor_y" class="form-control" value="<?= $adr['coor_y']?>" required>
							</div>

							<div class="col-md-4 mb-3">
								<label class="form-label">Coordinate Z</label>
								<input type="text"  id="coor_z" name="coor_z" class="form-control"  value="<?= $adr['coor_z']?>"required>
							</div>

							<div class="col-md-4 mb-3">
								<label class="form-label">Step Record</label>
								<input type="number" name="step_record" class="form-control" value="<?= $adr['step_record']?>" min="0" max="<?= $jumlah_prisma ?>" required>
							</div>

							<div class="col-md-4 mb-3">
								<label class="form-label">Retries</label>
								<input type="number" name="retries" class="form-control" value="<?= $adr['retries']?>" min="0"  required>
							</div>

							<div class="col-md-4 mb-3">
								<label class="form-label">Cycle Time</label>
								<input type="number"  min="0" name="cycle_time" class="form-control" value="<?= $adr['cycle_time']?>" required>
							</div>

						</div><!-- row -->

					</div><!-- modal body -->

					<div class="modal-footer">
						<button type="button" class="btn btn-light" data-bs-dismiss="modal">Batal</button>
						<button type="submit" class="btn btn-primary">Simpan</button>
					</div>

				</form>

			</div>
		</div>
	</div>



	<!-- =================================================================== -->
	<!-- 1) MODAL UTAMA (Main Menu)                                          -->
	<!-- =================================================================== -->
	<div class="modal fade" id="mainMenuModal" tabindex="-1">
		<div class="modal-dialog modal-lg modal-dialog-centered">
			<div class="modal-content">

				<div class="modal-header">
					<h5 class="modal-title">Main Menu</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
				</div>

				<div class="modal-body">
					<div class="row g-3">
						<div class="col-6">
							<div class="card text-center p-3 menu-card" id="openPrismaMenu">
								<i class="fa-solid fa-database fa-3x mb-2"></i>
								<h4 class="mb-0">Prisma Record</h4>
							</div>
						</div>

						<div class="col-6">
							<div class="card text-center p-3 menu-card">
								<i class="fa-solid fa-house fa-3x mb-2"></i>
								<h4 class="mb-0">Set RTS Home</h4>
							</div>
						</div>

						<div class="col-6">
							<div class="card text-center p-3 menu-card">
								<i class="fa-solid fa-location-crosshairs fa-3x mb-2"></i>
								<h4 class="mb-0">Turn RTS to Target</h4>
							</div>
						</div>

					</div>
				</div>

			</div>
		</div>
	</div>



	<!-- =================================================================== -->
	<!-- 2) SUBMENU PRISMA                                                   -->
	<!-- =================================================================== -->
	<div class="modal fade" id="prismaSubmenuModal" tabindex="-1">
		<div class="modal-dialog modal-lg modal-dialog-centered">
			<div class="modal-content">

				<div class="modal-header d-flex justify-content-between align-items-center">
					<div>
						<button type="button" class="bg-transparent ps-0 me-2 border-0" id="backToMainMenu">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
						</button>
						<span class="fw-bold">Prisma Record</span>
					</div>

					<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
				</div>


				<div class="modal-body">

					<div class="row g-3">

						<div class="col-6">
							<div class="card text-center p-3 prisma-menu" data-type="tambah">
								<i class="fa-solid fa-circle-plus fa-3x mb-2"></i>
								<h4 class="mb-0">Tambah Prisma</h4>
							</div>
						</div>

						<div class="col-6">
							<div class="card text-center p-3 prisma-menu" data-type="update">
								<i class="fa-solid fa-pen-to-square fa-3x mb-2"></i>
								<h4 class="mb-0">Update Prisma</h4>
							</div>
						</div>

					</div>

				</div>

			</div>
		</div>
	</div>



	<!-- =================================================================== -->
	<!-- 3) FORM PRISMA                                                      -->
	<!-- =================================================================== -->
	<div class="modal fade" id="prismaFormModal" tabindex="-1">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">

				<div class="modal-header d-flex justify-content-between align-items-center">
					<div>
						<button type="button" class="bg-transparent ps-0 border-0 me-2" id="backToPrismaMenu">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
						</button>
						<span id="formTitle" class="fw-bold">Tambah Prisma</span>
					</div>

					<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
				</div>

				<div class="modal-body">

					<form class="row" id="formPrisma" method="post" action="<?= base_url() ?>adr/input_prisma">
						<div class="col-12">
							<div class="mb-3">
								<label class="form-label">Nama Prisma</label>
								<input type="text" class="form-control" name="nama_prisma">
							</div>
						</div>
						<div class="col-4">

							<div class="mb-3">
								<label class="form-label">Slot</label>
								<input type="text" class="form-control" name="id_prisma">
							</div>
						</div>
						<div class="col-8">
							<div class="mb-3">
								<label class="form-label">Target Height</label>
								<input type="number" class="form-control" name="target_height">
							</div>
						</div>
						<button type="submit" class="btn btn-primary w-100">Simpan</button>
					</form>

				</div>

			</div>
		</div>
	</div>

	<script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.js" type="text/javascript"></script>

	<script>
		$(document).ready(function() {

			function sanitize(val) {
				return val.replace(/[^0-9.\-]/g, "");
			}

			// Paksa batas angka
			function clamp(val, min, max) {
				val = parseFloat(val);
				if (isNaN(val)) return "";
				if (val < min) return min;
				if (val > max) return max;
				return val;
			}

			// ========================
			// Latitude
			// ========================
			$("#coor_x, #coor_y, #coor_z").on("input", function () {
				let formatted = sanitize($(this).val());
				$(this).val(formatted);
			});

			var days_run = <?= json_encode($schedule) ?>;
			var task_run = <?= json_encode($schedule_all) ?>;

			days_run.forEach(function(item) {
				var ck = $('#btn_toggle_'+item.days);
				var ls = $('#set_run_'+item.days);
				ck.bootstrapToggle();
				$(ck).change(function() {
					if(this.checked) {
						ls.removeClass('d-none');
					}else{
						item.sc.forEach(function(i){
							console.log($("#"+"c"+i.id));
							$("#"+"i"+i.id).prop("disabled",true);
							$("#"+"c"+i.id).prop('checked', false);
						});
						ls.addClass('d-none');
					}
				});
			});

			task_run.forEach(function(item) {				
				$("#"+"c"+item.id).change(function () {
					$("#"+"i"+item.id).prop("disabled", !$(this).is(":checked"));
				});
			});

			var daftar_prisma = <?= json_encode($data_prisma) ?>;

			$('#submit_kontrol').click(function () {
				$('#load1').removeClass('d-none');
				$('#submit_kontrol').prop('disabled',true);
				$('#kode_akses').prop('disabled',true);
				var inp_kode = $('#kode_akses').val();
				$.ajax({
					type: "POST",
					url: "<?php echo base_url(); ?>kontrol/lanjut_kontrol",
					data: {
						akses: inp_kode,
					},
					dataType: "JSON",
					success: function (data) {

						if(data.status == 'error'){
							$('#kode_salah').removeClass('d-none');
							$('#submit_kontrol').prop('disabled',false);
							$('#kode_akses').prop('disabled',false);
						}else if(data.status == 'fail'){
							$('#proses_gagal').removeClass('d-none');
							$('#kode_akses').prop('disabled',false);
						} else{
							daftar_prisma.forEach(function(item) {
								$('#wait_'+item.id_prisma).removeClass('d-none');
								$('#data_'+item.id_prisma).addClass('d-none');
							});
							$('#kode_salah').addClass('d-none');
							$('.btn-kontrol').removeClass('d-none');
						}
						$('#load1').addClass('d-none');

					}
				}).fail(function(jqXHR, textStatus, errorThrown) {

					console.error("AJAX Error: " + textStatus, errorThrown);
				});

			});

			$.fn.inputFilter = function(callback, errMsg) {
				return this.on("input keydown keyup mousedown mouseup select contextmenu drop focusout", function(e) {
					if (callback(this.value)) {
						// Accepted value
						if (["keydown", "mousedown", "focusout"].indexOf(e.type) >= 0) {
							$(this).removeClass("input-error");
							this.setCustomValidity("");
						}
						this.oldValue = this.value;
						this.oldSelectionStart = this.selectionStart;
						this.oldSelectionEnd = this.selectionEnd;
					} else if (this.hasOwnProperty("oldValue")) {
						// Rejected value - restore the previous one
						$(this).addClass("input-error");
						this.setCustomValidity(errMsg);
						this.reportValidity();
						this.value = this.oldValue;
						this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
					} else {
						// Rejected value - nothing to restore
						this.value = "";
					}
				});
			};
			localStorage['status'] = '0';

			var MQTTbroker = 'mqtt.beacontelemetry.com';
			var MQTTport = 8083;
			var MQTTsubTopic = "rts-30002";
			var MQTTsubTopic2 = "kontrol-asaba";
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
					client.subscribe(MQTTsubTopic2, {qos: 0});
				},
				onFailure: function (message) {
					console.log(message);
				}
			};
			function onConnectionLost(responseObject) {
			};
			function onMessageArrived(message) {
				var sts = localStorage['status'] || '0';
				var dataLog = message.payloadString;
				var dataLogObj = JSON.parse(dataLog);
				$('.temp_waktu').text(dataLogObj.waktu);
				var inp_kode = $('#kode_akses').val();
				if(message.destinationName == 'kontrol-asaba') {
					if(dataLogObj.status == '1' ){
						$(".status_run").addClass('d-none');
						$('#last_running').text(dataLogObj.datetime);
						$('#sts_rts').text('Running');
						$('.btn-kontrol').removeClass('d-none');
						$('#submit_kontrol').prop("disabled", true);
						$('#use_kontrol').removeClass('d-none');
					}else{
						$.ajax({
							url: '<?php echo base_url(); ?>datamasuk/selesai_kontrol',
							method: 'get',
							success:function(data){

								location.reload();
								$('#use_kontrol').addClass('d-none');
								$('#submit_kontrol').prop('disabled',false);
								$('.btn-kontrol').addClass('d-none');
								$('#kode_akses').prop('disabled',false);
							}
						});

					}
				}else{
					$('#wait_'+dataLogObj.id_prisma).addClass('d-none');
					$('#data_'+dataLogObj.id_prisma).removeClass('d-none');
					$("#E1_"+dataLogObj.id_prisma).text(dataLogObj.E1);
					$("#N1_"+dataLogObj.id_prisma).text(dataLogObj.N1);
					$("#Z1_"+dataLogObj.id_prisma).text(dataLogObj.Z1);
					if(dataLogObj.N1 == '0' && dataLogObj.E1 == '0' && dataLogObj.Z1 == '0'){
						console.log("#status_run"+dataLogObj.id_prisma);
						$("#status_run"+dataLogObj.id_prisma).empty();
						$("#status_run"+dataLogObj.id_prisma).append('<div class="badge badge-outline status_run text-danger" style="position:absolute; right:15px;font-size:11px">Not Found</div>');
					}else{
						$("#status_run"+dataLogObj.id_prisma).empty();
						$("#status_run"+dataLogObj.id_prisma).append('<div class="badge badge-outline status_run text-success" style="position:absolute; right:15px;font-size:11px">Success</div>');
					}

				}
			};
			client.connect(options);
		});
	</script>
	<script>
		$(function () {

			$("#openPrismaMenu").on("click", function () {
				$("#mainMenuModal").modal("hide");
				setTimeout(() => $("#prismaSubmenuModal").modal("show"), 100);
			});

			$(".prisma-menu").on("click", function () {
				let type = $(this).data("type");

				// Tutup Modal Submenu
				$("#prismaSubmenuModal").modal("hide");

				if (type === "tambah") {
					setTimeout(() => $("#prismaFormModal").modal("show"), 150);
				} 
				else if (type === "update") {
					window.location.href = "<?= base_url() ?>/adr/daftar_prisma";
				}
			});

			$("#backToPrismaMenu").on("click", function () {
				$("#prismaFormModal").modal("hide");
				setTimeout(() => $("#prismaSubmenuModal").modal("show"), 100);
			});


			$("#backToMainMenu").on("click", function () {
				$("#prismaSubmenuModal").modal("hide");
				setTimeout(() => $("#mainMenuModal").modal("show"), 100);
			});


		});
	</script>
