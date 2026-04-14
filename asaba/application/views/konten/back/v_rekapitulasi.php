<style>
 
.table td:first-child {
  position: sticky;
  left: 0;
  background-color:#f8fafc;
 
}
</style>

<script src="https://code.highcharts.com/highcharts.js"></script>
<script src="https://code.highcharts.com/highcharts-more.js"></script>
<script src="https://code.highcharts.com/modules/exporting.js"></script>
<script src="https://code.highcharts.com/modules/export-data.js"></script>
<script src="https://code.highcharts.com/modules/no-data-to-display.js"></script>
<?php
if ($this->input->get('theme') == 'dark') {
	echo '<script src="https://code.highcharts.com/themes/dark-unica.js"></script>';
} else {
	echo '<script src="https://code.highcharts.com/js/themes/grid.js"></script>';
}
?>


<div class="container-md">
	<div class="page-header d-print-none">
		<div class="row g-3 align-items-center">
			<div class="col-auto">

			</div>
			<div class="col">
				<h3 class="page-title">
					Monitoring
				</h3>

			</div>
		</div>
	</div>
</div>


<div class="page-body">
	<div class="container-xl">
		<div class="row row-cards">
			<div class="col-md-2">
				<div class="row row-cards">
					<div class="col-md-12">
						<div class="card">
							<div class="card-body px-3">
								<div class="d-flex justify-content-between align-items-center mb-2">
									<div class="subheader mb-0"><label class="form-label mb-0">Pilih Kategori</label> </div>

								</div>
								<div class="h3 m-0">
									<?php echo form_open('monitoring/set_kategori'); ?>
									<select type="text" name="id_kategori" class="form-select" placeholder="Pilih Kategori" onchange="this.form.submit()" id="select-pos2" value=" ">
										<option disabled selected>Pilih Kategori</option>
										<?php foreach($kategori as $kt) {?>
										<option value="<?=$kt['id_katlogger']?>" <?= ($this->session->userdata('id_kategori_rekap')==$kt['id_katlogger']) ? 'selected' : '' ?>><?= $kt['nama_kategori']?></option>
										<?php } ?>
									</select>
									<?php echo form_close() ?>
								</div>
							</div>
						</div>
					</div>
					<div class="col-md-12">
						<div class="card">
							<div class="card-body px-3">
								<div class="subheader"><label class="form-label">Pilih Tanggal</label></div>
								<div class="h3 m-0">
									<?php echo form_open('monitoring/set_tanggal'); ?>
									<div class="row">
										<div class="col-12 col-md-12 col-sm-12">
											<div class="input-icon">
												<input class="form-control " name="tgl" placeholder="Pilih Tanggal" id="dptanggal" value="<?= $this->session->userdata('tanggal_rekap') ?>" autocomplete="off" required />
												<span class="input-icon-addon">
													<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
														<path stroke="none" d="M0 0h24v24H0z" fill="none" />
														<rect x="4" y="5" width="16" height="16" rx="2" />
														<line x1="16" y1="3" x2="16" y2="7" />
														<line x1="8" y1="3" x2="8" y2="7" />
														<line x1="4" y1="11" x2="20" y2="11" />
														<line x1="11" y1="15" x2="12" y2="15" />
														<line x1="12" y1="15" x2="12" y2="18" />
													</svg>
												</span>
											</div>
											<div class="form-footer">
												<input type="submit" class="btn btn-info w-100" value="Tampil" />
											</div>
										</div>
									</div>
									<?php echo form_close() ?>
								</div>
							</div>
						</div>
					</div>

					<!-- IMPORT DATA --------------------------------     
  <div class="col-md-12">
 <div class="card">
   <div class="card-body">
   <div class="subheader"><label class="form-label">Import Data</label></div>
  <div class="h3 m-0">

 <input type="file" class="form-control" />

  </div>
   </div>
 </div>
  </div>

   End Import Data ---------------------------->
				</div>
			</div>
			<div class="col-md-10">
				<div class="card">
					<div class="card-body">
						<?php if($this->session->userdata('id_kategori_rekap')) { ?>
						<h5 class="card-title">Monitoring <?= $nama_logger ?> <?= ($nama_logger == 'ARR') ? '(Curah Hujan)': '(Tinggi Muka Air)' ?> pada <?= $this->session->userdata('tanggal_rekap');?></h5>
						<div class="table-responsive">
							<table class="table table-vcenter table-bordered">
								<thead>
									<tr>
										<th style=" position: sticky;left: 0;background-color:#f8fafc;" rowspan="2">Nama Pos</th>
										<th colspan="24" class="text-center">Jam</th>
										<?php if($this->session->userdata('id_kategori_rekap') == '1') {?> 
										<th rowspan='2'>Akumulasi</th>
										<?php } ?>

									</tr>
									<tr>
										<?php for($i = 0; $i < 24; $i++) {

										?>
										<th class="text-center"><?= ($i < 10) ? '0'.$i : $i  ?>:00</th>
										<?php } ?>
									</tr>
								</thead>
								<tbody>
									<?php foreach($data_rekap as $key=>$lg):?>
									<tr>
										<td  class="d-flex justify-content-between" style="white-space: nowrap;">
		<a href="<?= base_url() . $lg['tabel']  ?>/set_sensordash?tabel=<?= $lg['tabel'] ?>&id_param=<?= $lg['id_param'] ?>"><?= $lg['nama_logger'];?> </a>
											
											<?php $param = $this->db->get_where('klasifikasi_tma', array('idlogger'=>$lg['id_logger']))->row(); 
																				 if(!$param and $nama_logger =='AWLR'){
																					 echo '<button type="button" class="p-0 bg-white" style="border:0px" data-bs-toggle="tooltip" data-bs-placement="right" title="Tingkat status belum diatur">
  <svg xmlns="http://www.w3.org/2000/svg" class="ms-2 icon icon-tabler icon-tabler-alert-octagon text-warning" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
											<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
											<path d="M9.103 2h5.794a3 3 0 0 1 2.122 .879l4.101 4.101a3 3 0 0 1 .88 2.123v5.794a3 3 0 0 1 -.879 2.122l-4.101 4.101a3 3 0 0 1 -2.122 .879h-5.795a3 3 0 0 1 -2.122 -.879l-4.101 -4.1a3 3 0 0 1 -.88 -2.123v-5.794a3 3 0 0 1 .879 -2.122l4.101 -4.101a3 3 0 0 1 2.123 -.88z"></path>
											<path d="M12 8l0 4"></path>
											<path d="M12 16l.01 0"></path>
										</svg>
</button>
';
																				 }
											?> 
										</td>
										<?php 
																				 $jumlah = 0;
																				 foreach($lg['data'] as $dt):
																				 if($this->session->userdata('id_kategori_rekap') == '1' && $dt['nilai'] != '-'){
																					 $jumlah += $dt['nilai'];
																				 }
										?>
										<td class="text-center <?= ($dt['warna'] == 'white' or $dt['warna'] == '#fef216') ? 'text-dark':'text-light'?> fw-bold" style="background-color:<?=  $dt['warna']?>">
											<?php if($nama_logger == 'AWLR'){?>
												<div class="d-flex justify-content-center mb-0" style="font-size:12px"><?= ($dt['nilai'] == '-') ? '-':number_format($dt['nilai'],1) ;?> <?= ($dt['nilai'] != '-') ? '<span class="ps-1">m</span>':'' ?> </div>	
											<?php } else{?>
												<div class="d-flex justify-content-center mb-0" style="font-size:12px"><?= ($dt['nilai'] == '-') ? '-':number_format($dt['nilai'],1) ;?> <?= ($dt['nilai'] != '-') ? '<span class="ps-1">mm</span>':'' ?> </div>	
											<?php }?>
											
										</td>
										<?php endforeach;?>
										<?php

																				 if($this->session->userdata('id_kategori_rekap') == '1') {
																					 $param = $this->db->get_where('klasifikasi_hujan', array('waktuper'=>'perhari'))->row();
																					 if($jumlah <= $param->hijau) {
																						 $color = 'white';
																					 }
																					 elseif($jumlah >= $param->biru && $jumlah < $param->biru_tua) {
																						 $color = '#70cddd';
																					 }
																					 elseif($jumlah >=  $param->biru_tua && $jumlah <  $param->kuning){
																						 $color = '#35549d';
																					 }
																					 elseif($jumlah >=  $param->kuning && $jumlah <  $param->oranye) {
																						 $color = '#fef216';
																					 }
																					 elseif($jumlah >=  $param->oranye && $jumlah <  $param->merah) {
																						 $color = '#f47e2c';
																					 }
																					 elseif($jumlah >=  $param->merah) {
																						 $color = '#ed1c24';
																					 }
										?> 
										<td class="text-center <?= ($color == 'white' or $color == '#fef216') ? 'text-dark':'text-light'?> fw-bold" style="background-color:<?= $color?>">
											<?php if($nama_logger == 'AWLR'){?>
												<div class="d-flex mb-0"><?= number_format($jumlah,1) ?> <span class="ps-1">m</span> </div>
											<?php } else{?>
												<div class="d-flex mb-0"><?= number_format($jumlah,1) ?> <span class="ps-1">mm</span> </div>
											<?php }?>
											
										</td>
										<?php } ?>

									</tr>
									<?php endforeach;?>
								</tbody>
							</table>
							
						</div>
							<?php if($nama_logger == 'ARR'){?>
								<div class="row mt-1">
									<div class="col-xl-1 d-flex align-items-center justify-content-xl-between">
										<h4 class="mb-0">Keterangan</h4>
										<h4 class="mb-0">:</h4>
									</div>
									<div class="col-xl-9">
										<div class="row gx-2">
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-2">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:white;height:35px;"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Tidak Hujan</h5>
													</div>

												</div>
											</div>
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-2">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#70cddd;height:35px;"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Hujan Sangat Ringan</h5>
													</div>

												</div>
											</div>
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-2">

													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#35549d;height:35px"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Hujan Ringan</h5>
													</div>
												</div>
											</div>
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2  pt-2 pt-lg-2">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#fef216;height:35px"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Hujan Sedang</h5>
													</div>

												</div>
											</div>
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-2">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#f47e2c;height:35px"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Hujan Lebat</h5>
													</div>

												</div>
											</div>
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-2">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#ed1c24;height:35px"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Hujan Sangat Lebat</h5>
													</div>

												</div>
											</div>
										</div>
									</div>
								</div>
							<?php } else{?>
								<div class="row mt-3">
									<div class="col-xl-1 d-flex align-items-center justify-content-lg-between">
										<h4 class="mb-0">Keterangan</h4>
										<h4 class="mb-0">:</h4>
									</div>
									<div class="col-xl-9">
										<div class="row gx-2">
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-0">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#fef216;height:35px;"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Waspada</h5>
													</div>

												</div>
											</div>
											<div class="col-xl-2 col-6">
												<div class="row h-100 gx-2 pt-2 pt-lg-0">
													<div class="col-3">
														<div class="rounded border border-dark" style="background-color:#ed1c24;height:35px;"></div>
													</div>
													<div class="col-9 d-flex align-items-center">
														<h5 class="mb-0">Siaga</h5>
													</div>

												</div>
											</div>
										</div>
									</div>
								</div>
							<?php }?>
						
						<?php } else{?> 
						<h5 class="fw-semibold">Pilih Kategori Terlebih Dahulu !</h5>
						<?php }?>

					</div>
				</div>
			</div>
		</div>
	</div>
</div>


<script>
	// @formatter:off
	document.addEventListener("DOMContentLoaded", function() {
		var el;
		window.TomSelect && (new TomSelect(el = document.getElementById('select-pos'), {
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
	});
	// @formatter:on
</script>

<script>
	// @formatter:off
	document.addEventListener("DOMContentLoaded", function() {
		var el;
		window.TomSelect && (new TomSelect(el = document.getElementById('select-pos2'), {
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
	});
	// @formatter:on
</script>
<script>
	// @formatter:off
	document.addEventListener("DOMContentLoaded", function() {
		var el;
		window.TomSelect && (new TomSelect(el = document.getElementById('select-parameter'), {
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
	});
	// @formatter:on
</script>