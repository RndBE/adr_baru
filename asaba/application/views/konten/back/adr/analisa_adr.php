<script src="<?php echo base_url();?>code/highcharts.js"></script>
<script src="<?php echo base_url();?>code/highcharts-more.js"></script>
<script src="<?php echo base_url();?>code/modules/series-label.js"></script>
<script src="<?php echo base_url();?>code/modules/exporting.js"></script>
<script src="<?php echo base_url();?>code/modules/export-data.js"></script>
<script src="<?php echo base_url();?>code/js/themes/grid.js"></script>
<style>
	@media only screen and (max-width: 576px) {
		#target {
			display: none;
		}
	}
	.btn-info{
		background-color:#303481;
	}
	.btn-info:hover {

		text-decoration: none;
		background-color: #000342;
		border-color: #000342;
	}
	.circle {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		box-shadow: 0px 0px 1px 1px #0000001a;
	}
	.pulse-brown {
		background: #876a2f;
		animation: pulse-animation-brown 2s infinite;
	}
	@keyframes pulse-animation-brown {
		0% {
			box-shadow: 0 0 0 0px #876a2f;
		}
		100% {
			box-shadow: 0 0 0 15px rgba(0, 0, 0, 0);
		}
	}
</style>

<?php
$stat=$this->db->query('select waktu from temp_rts where code_logger="30002"')->row();

$awal=date('Y-m-d H:i',(mktime(date('H')-1)));
$waktuterakhir=$stat->waktu;
if($waktuterakhir >= $awal)
{
	$color="green";
	$status_logger="Koneksi Terhubung";
}
else{
	$color="dark";
	$status_logger="Koneksi Terputus";
}
$stts='0';
$perbaikan = $this->db->get_where('t_perbaikan', array('id_logger'=> $this->session->userdata('idlogger')))->row();
if($perbaikan){
	$stts='1';
	$status_logger="Perbaikan";
}else{
	$stts='0';
}


if($data_sensor== null )
{
	$namasensor='';

}else
{
	$namasensor=str_replace('_', ' ', $data_sensor->{'namaSensor'});
	$satuan=$data_sensor->{'satuan'};
	$tooltip=$data_sensor->{'tooltip'};
	$data = $data_sensor->{'data'};
	$range=$data_sensor->{'range'};
	$nosensor= $data_sensor->{'nosensor'};
	$typegraf=$data_sensor->{'tipe_grafik'};
	$nama_prisma = $this->db->where('id_prisma',$this->session->userdata('id_prisma'))->get('t_prisma')->row();
}

?>

<div class="container-md">
	<div class="page-header d-print-none">
		<div class="row g-3 align-items-center">
			<div class="col-auto">

				<?php echo anchor('analisa','<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-big-left-lines" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                 <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                 <path d="M12 15v3.586a1 1 0 0 1 -1.707 .707l-6.586 -6.586a1 1 0 0 1 0 -1.414l6.586 -6.586a1 1 0 0 1 1.707 .707v3.586h3v6h-3z"></path>
                 <path d="M21 15v-6"></path>
                 <path d="M18 15v-6"></path>
              </svg>
') ?>

			</div>
			<?php if ($stts=='1') {?>
			<div class="col-auto "><div class="circle pulse-brown mx-3" ></div></div>
			<?php }else {?>
			<div class="col-auto">
				<span class="status-indicator status-<?php echo $color?> status-indicator-animated">
					<span class="status-indicator-circle"></span>
					<span class="status-indicator-circle"></span>
					<span class="status-indicator-circle"></span>
				</span>
			</div>
			<?php } ?> 

			<div class="col col-md-auto">
				<h2 class="page-title">
					<?php echo $this->session->userdata('namalokasi'); ?>

				</h2>
				<div class="text-muted">
					<ul class="list-inline list-inline-dots mb-0">
						<?php if ($stts=='1') {?>
						<li class="list-inline-item"><span style="color:#876a2f"><?php echo $status_logger ?></span></li>
						<?php }else {?>
						<li class="list-inline-item"><span class="text-<?php echo $color?>"><?php echo $status_logger ?></span></li>
						<?php } ?> 
					</ul>
				</div>
			</div>
			<div class="col-12 col-md">

				<div class="row g-3 align-items-center justify-content-end">
					<div class="col-6 d-md-none">
						<button class="btn w-100 toggle">
							<!-- Download SVG icon from http://tabler-icons.io/i/settings -->
							<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-layout-list" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
								<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
								<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
								<path d="M4 14m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
							</svg>
							Opsi
						</button>
					</div>
					<div class="col-6 col-md-auto">
						<a class="btn w-100" data-bs-toggle="offcanvas" href="#offcanvasEnd" role="button" aria-controls="offcanvasEnd">
							<!-- Download SVG icon from http://tabler-icons.io/i/settings -->
							<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-file-info" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
								<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
								<path d="M14 3v4a1 1 0 0 0 1 1h4"></path>
								<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"></path>
								<path d="M11 14h1v4h1"></path>
								<path d="M12 11h.01"></path>
							</svg>
							Informasi
						</a>
					</div>

				</div>
			</div>
		</div>
	</div>
	<script type="text/javascript">
		$('.toggle').click(function() {
			$('#target').toggle('fast');
		});
	</script>
</div>


<div class="page-body">
	<div class="container-xl">
		<div class="row row-cards">
			<div class="col-md-3 col-xxl-2"  id="target">
				<div class="row row-cards">
					<div class="col-md-12">
						<div class="card">
							<div class="card-body">
								<div class="subheader"><label class="form-label">Pilih Prisma</label></div>
								<div class="h3 m-0"> 
									<?php  

									echo form_open('adr/set_prisma');?>
									<select type="text" name="id_prisma" class="form-select" placeholder="Pilih Prisma" onchange="this.form.submit()" id="select-pos" value=" ">
										<option value="">Pilih Pos</option>
										<?php foreach($pilih_pos as $mnpos ):?>
										<option value="<?= $mnpos->id_prisma ?>" <?= ($this->session->userdata('id_prisma') == $mnpos->id_prisma) ? 'selected' : '' ?>><?= str_replace('_', ' ', $mnpos->nama_prisma) ?></option>
										<?php endforeach ?>
									</select>
									<?php echo form_close() ?>
								</div>
							</div>
						</div>
					</div>
					<div class="col-md-12">
						<div class="card">
							<div class="card-body">
								<div class="subheader"><label class="form-label">Pilih Parameter</label></div>
								<div class="h3 m-0">

									<?php  
	echo form_open('adr/set_parameter');?>
									<select type="text" name="id_param" class="form-select" placeholder="Pilih Parameter"  onchange="this.form.submit()"  id="select-parameter" value=" ">
										<option value="">Pilih Parameter</option>
										<?php foreach($pilih_parameter as $mnparameter ):?>
										<option value="<?= $mnparameter->id_param ?>" <?= ($this->session->userdata('idparameter') == $mnparameter->id_param) ? 'selected' : '' ?>><?= str_replace('_', ' ', $mnparameter->nama_parameter)?></option>
										<?php endforeach ?>
									</select>
									<?php echo form_close() ?>

								</div>
							</div>
						</div>
					</div>

					<div class="col-md-12">
						<div class="card">
							<div class="card-body">
								<div class="subheader"><label class="form-label">Pilih Rentang Waktu</label></div>
								<div class="h3 m-0">
									<?php echo form_open('adr/setrange') ;?>
									<div class="row">
										<div class="col-12 col-md-12 col-sm-12">
											<div class="row">
												<div class="col-12 col-md-12 col-sm-12">
													<label class="form-label">Dari</label>
													<div class="input-icon">

														<input class="form-control" name="dari" placeholder="Dari" id="dpdari" value="<?= $this->session->userdata('dari') ?>" autocomplete="off" required/>
														<span class="input-icon-addon">
															<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="4" y1="11" x2="20" y2="11" /><line x1="11" y1="15" x2="12" y2="15" /><line x1="12" y1="15" x2="12" y2="18" /></svg>
														</span>
													</div>
												</div>
												<div class="col-12 col-md-12 col-sm-12">
													<label class="form-label mt-2">Sampai</label>
													<div class="input-icon">

														<input class="form-control" name="sampai" placeholder="Sampai" id="dpsampai" value="<?= $this->session->userdata('sampai')?>" autocomplete="off" required/>
														<span class="input-icon-addon">
															<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="4" y1="11" x2="20" y2="11" /><line x1="11" y1="15" x2="12" y2="15" /><line x1="12" y1="15" x2="12" y2="18" /></svg>
														</span>
													</div>
												</div>
											</div>
											<div class="form-footer">
												<input type="submit" class="btn btn-info w-100" value="Tampil"/>
											</div>
										</div>

									</div>
									<?php echo form_close() ?>
								</div>
							</div>
						</div>
					</div>



					<div class="col-md-12">
						<div class="card">
							<div class="card-body">
								<button onclick="ExportToExcel('xlsx')" class="btn btn-outline-success w-100  ">
									<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-file-spreadsheet" width="40" height="40" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
										<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
										<path d="M14 3v4a1 1 0 0 0 1 1h4"></path>
										<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"></path>
										<path d="M8 11h8v7h-8z"></path>
										<path d="M8 15h8"></path>
										<path d="M11 11v7"></path>
									</svg>Download Excel
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="col-md-9 col-xxl-10">

				<div class="row row-cards">
					<div class="col-md-12">

						<div class="card">
							<div class="card-body">
								<div class="row  gx-2">
									<div class="col-xxl-6">
										<div class="card mb-3">
											<div class="card-header py-2 fw-bold" >
												Pengukuran Terbaru
											</div>
											<div class="card-body py-2 ">
												<div class="row ">
													<div class="col-auto">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center">
																Tanggal :
																<b class="mt-1"><?= ($data_last) ? $data_last->waktu :'-'?></b>
															</div>
														</div>
													</div>
													<div class="col">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center">
																Easting (X) : <b class="mt-1"><?= ($data_last) ? $data_last->sensor9 :'-'?></b>
															</div>
														</div>
													</div>
													<div class="col">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center ">

																Northing (Y) : <b class="mt-1"><?= ($data_last) ? $data_last->sensor8 :'-'?></b>
															</div>
														</div>
													</div>
													<div class="col">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center">
																Elevation  :
																<b class="mt-1"><?= ($data_last) ? $data_last->sensor10 :'-'?></b>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="col-xxl-6">
										<div class="card mb-3" >
											<div class="card-header py-2 fw-bold" >
												Awal Pengukuran
											</div>
											<div class="card-body py-2 " style="border-color:#2e3582">
												<div class="row ">
													<div class="col-auto">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center">
																Tanggal :
																<b class="mt-1"><?= ($data_first) ? $data_first->waktu :'-'?></b>
															</div>
														</div>
													</div>
													<div class="col">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center">
																Easting (X) :
																<b class="mt-1"><?= ($data_first) ? $data_first->sensor9 :'-'?></b>
															</div>
														</div>
													</div>
													<div class="col">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center ">
																Northing (Y) :
																<b class="mt-1"><?= ($data_first) ? $data_first->sensor8 :'-'?></b>
															</div>
														</div>
													</div>
													<div class="col">
														<div class="card">
															<div class="card-body py-2 px-3 d-flex flex-column align-items-center">
																Elevation  :
																<b class="mt-1"><?= ($data_first) ? $data_first->sensor10 :'-'?></b>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div id="analisa" class="pe-2"></div>
								<div class="w-100 mt-3 card">
									<?php $title= " dari ". $this->session->userdata('dari')." sampai ".$this->session->userdata('sampai'); 
									?>
									<div class="table-responsive">
										<table class="table mb-0 table-bordered table-sm" id="tbl_exporttable_to_xls">
											<thead>
												<tr>
													<th colspan="4" ><h5 class="mb-0 fw-bold"><?= str_replace("_"," ","$data_sensor->namaSensor") . $title ?></h5></th>
												</tr>

												<tr >
													<th class="d-none "><h5 class="mb-0 fw-bold"><?= $this->session->userdata('pada') ?></h5></th>
												</tr>
												<tr>
													<th >Waktu</th>
													<th ><?= str_replace("_"," ","$data_sensor->namaSensor")?></th>
													<?php if ($typegraf == 'column') { ?>

													<th >Minimal</th>
													<th >Maksimal</th>
													<?php } ?>
												</tr>
											</thead>
											<tbody>
												<?php foreach($data_sensor->data_tabel as $dt) : ?>
												<tr>
													<td><?= $dt->waktu ?></td>
													<td><?= $dt->dta . ' ' . $data_sensor->satuan ?></td>
													<?php if ($typegraf == 'column') { ?>
													<td><?= $dt->min . ' ' . $data_sensor->satuan  ?></td>
													<td><?= $dt->max . ' ' . $data_sensor->satuan ?></td>
													<?php } ?>
												</tr>
												<?php endforeach; ?>
											</tbody>
										</table>
									</div>
								</div>
								<div class="offcanvas offcanvas-end" tabindex="-1" id="offcanvasEnd" aria-labelledby="offcanvasEndLabel">
									<div class="offcanvas-header">
										<h2 class="offcanvas-title" id="offcanvasEndLabel">Informasi Logger</h2>
										<button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
									</div>
									<div class="offcanvas-body">
										<div>
											<table class="table table-sm table-borderless">
												<tbody>
													<?php 
													$query_informasi=$this->db->query('select * from t_informasi where logger_id="'.$this->session->userdata('idlogger').'"');
													foreach($query_informasi->result() as $tinfo)
													{
													?>
													<tr> <td  class="fw-bold">Id Logger</td><td class="text-end"><?php  echo $tinfo->logger_id ?></td></tr>
													<tr> <td  class="fw-bold">Seri Logger</td><td class="text-end"><?php  echo $tinfo->seri ?></td></tr>
													<tr> <td  class="fw-bold">Sensor</td><td class="text-end"><?php  echo $tinfo->sensor ?></td></tr>
													<tr> <td  class="fw-bold">Serial Number</td><td class="text-end"><?php  echo $tinfo->serial_number ?></td></tr>
													<tr> <td  class="fw-bold">No. Seluler</td><td class="text-end"><?php  echo $tinfo->nosell  ?></td></tr>
													<tr> <td  class="fw-bold">IMEI</td><td class="text-end"><?php  echo $tinfo->imei ?></td></tr>
													<tr> <td  class="fw-bold">Tanggal Kontrak</td><td class="text-end"><?php  echo $tinfo->tgl_kontrak ?></td></tr>
													<tr> <td  class="fw-bold">Logger Aktif</td><td class="text-end"><?php  echo $tinfo->tgl_aktif ?></td></tr>
													<tr> <td  class="fw-bold">Masa Garansi</td><td class="text-end"><?php  echo $tinfo->garansi ?></td></tr>
													<?php } ?>
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
	</div>
</div>



<?php 

$namafile = $this->session->userdata('namalokasi') . ' - ' . str_replace('_',' ',$data_sensor->namaSensor,) . ' - ' . $this->session->userdata('dari'). ' - '. $this->session->userdata('sampai');
?>

<script>
	// @formatter:off
	document.addEventListener("DOMContentLoaded", function () {
		var el;
		window.TomSelect && (new TomSelect(el = document.getElementById('select-pos'), {
			copyClassesToDropdown: false,
			dropdownClass: 'dropdown-menu ts-dropdown',
			optionClass:'dropdown-item',
			controlInput: '<input>',
			render:{
				item: function(data,escape) {
					if( data.customProperties ){
						return '<div><span class="dropdown-item-indicator">' + data.customProperties + '</span>' + escape(data.text) + '</div>';
					}
					return '<div>' + escape(data.text) + '</div>';
				},
				option: function(data,escape){
					if( data.customProperties ){
						return '<div><span class="dropdown-item-indicator">' + data.customProperties + '</span>' + escape(data.text) + '</div>';
					}
					return '<div>' + escape(data.text) + '</div>';
				},
			},
		}));
		var el2;
		window.TomSelect && (new TomSelect(el2 = document.getElementById('select-parameter'), {
			copyClassesToDropdown: false,
			dropdownClass: 'dropdown-menu ts-dropdown',
			optionClass:'dropdown-item',
			controlInput: '<input>',
			render:{
				item: function(data,escape) {
					if( data.customProperties ){
						return '<div><span class="dropdown-item-indicator">' + data.customProperties + '</span>' + escape(data.text) + '</div>';
					}
					return '<div>' + escape(data.text) + '</div>';
				},
				option: function(data,escape){
					if( data.customProperties ){
						return '<div><span class="dropdown-item-indicator">' + data.customProperties + '</span>' + escape(data.text) + '</div>';
					}
					return '<div>' + escape(data.text) + '</div>';
				},
			},
		}));
	});
	// @formatter:on
</script>
<script type="text/javascript" src="https://unpkg.com/xlsx@0.15.1/dist/xlsx.full.min.js"></script>
<script>
	function ExportToExcel(type, fn, dl) {
		var elt = document.getElementById('tbl_exporttable_to_xls');
		var wb = XLSX.utils.table_to_book(elt, {
			sheet: "sheet1"
		});
		return dl ?
			XLSX.write(wb, {
			bookType: type,
			bookSST: true,
			type: 'base64'
		}) :
		XLSX.writeFile(wb, fn || ('<?= $namafile ?>.' + (type || 'xlsx')));
	}
</script><script type="text/javascript">
		Highcharts.chart('analisa', {
		chart: {
			zoomType: 'xy',
			borderWidth:1.5,
			backgroundColor:'#FEFEFE',
			borderRadius:3,
			borderColor:'#2e3582'
		},

		title: {
			text: "<?php echo $namasensor ?> <?php echo $title ?>"
		},
		subtitle: {
			text: 'Pos RTS PT MIP <?= $this->session->userdata("temp_kontrol")->site =="ccp"? "CCP3":"View Point" ?>'
		},
		xAxis: [{
			type: 'datetime',
			dateTimeLabelFormats: { // don't display the dummy year
				millisecond: '%H:%M',
				second: '%H:%M',
				minute: '%H:%M',
				hour: '%H:%M',
				day: '%e. %b %y',
				week: '%e. %b %y',
				month: '%b \'%y',
				year: '%Y'

			},
			crosshair: true
		}],
		yAxis: [ { // Secondary yAxis

			tickAmount: 5,

			title: {
				text: "Northing Y",
				style: {
					color: Highcharts.getOptions().colors[1]
				}
			},
			labels: {
				format: "{value} ",

				style: {
					color: Highcharts.getOptions().colors[1]
				}
			}

		}],
		tooltip: {
			xDateFormat: 'Waktu %d-%m-%Y %H:%M',
			shared: true
		},
		/*s  legend: {
            layout: 'vertical',
            align: 'left',
            x: 10,
            verticalAlign: 'top',
            y: 30,
            floating: true,
            backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
        },
        */
		credits: {
			enabled: false
		},
		exporting: {
			buttons: {
				contextButton: {
					menuItems: ['printChart','separator','downloadPNG', 'downloadJPEG','downloadXLS']
				}
			},
			showTable:false
		},
				series: [ {
			name: 'Northing Y',
			type: 'spline',
			data:  <?php echo str_replace('"','',json_encode($data)); ?>,
			zIndex: 1,
			marker: {
			fillColor: 'white',
			lineWidth: 2,
			lineColor: Highcharts.getOptions().colors[0]
	},
					 tooltip: {
					 valueSuffix: ' ',
					 valueDecimals: 2,
					 },

	}
			],

		responsive: {
			rules: [{
				condition: {
					maxWidth: 500
				},
				chartOptions: {
					legend: {
						layout: 'horizontal',
						align: 'center',
						verticalAlign: 'bottom'
					}
				}
			}]
		}

	});
</script>
