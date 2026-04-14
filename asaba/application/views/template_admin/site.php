<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8"/>
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
		<meta http-equiv="X-UA-Compatible" content="ie=edge"/>
		<meta http-equiv="refresh" content="600">
		<title>Demo PT MIP</title>
		<style>
			@import url('https://rsms.me/inter/inter.css');
			:root {
				--tblr-font-sans-serif: Inter,-apple-system,BlinkMacSystemFont,San Francisco,Segoe UI,Roboto,Helvetica Neue,sans-serif !important;
			}
		</style>
		<!-- CSS files -->
		<link rel="icon" href="<?php echo base_url()?>image/logo_single.png">
		<link href="https://stesy.beacontelemetry.com/assets/code/tabler.min.css" rel="stylesheet"/>
		<link href="https://stesy.beacontelemetry.com/assets/code/tabler-flags.min.css" rel="stylesheet"/>
		<link href="https://stesy.beacontelemetry.com/assets/code/tabler-payments.min.css" rel="stylesheet"/>
		<link href="https://stesy.beacontelemetry.com/assets/code/tabler-vendors.min.css" rel="stylesheet"/>
		<link href="https://stesy.beacontelemetry.com/assets/code/demo.min.css" rel="stylesheet"/>


		<link href="https://cdn.datatables.net/1.13.1/css/jquery.dataTables.min.css" rel="stylesheet" type="text/css" />
		<link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">
		<link rel="stylesheet" href="https://jqueryui.com/resources/demos/style.css">
		<link rel="stylesheet" href="<?php echo base_url()?>plugin/datetimepicker/build/jquery.datetimepicker.min.css"/>
		<style>

			.navbar {
				--tblr-navbar-active-border-color: #FFD615;
			}
		</style>
		<?php

	if($this->session->userdata('data')=='bulan')
	{
		?>
		<style type="text/css">
			.ui-datepicker-calendar {
				display: none;
			}

		</style>
		<?php

	}
			  elseif($this->session->userdata('data')=='tahun')
			  {
		?>
		<style type="text/css">
			.ui-datepicker-calendar {
				display: none;
			}
			.ui-datepicker-prev{
				display: none;
			}
			.ui-datepicker-next{
				display: none;
			}
			.ui-datepicker-month{
				display: none;
			}
		</style>
		<?php
			  }
		?>

		<style type="text/css">
			.highcharts-data-table table {
				border-collapse: collapse;
				border-spacing: 0;
				background: white;
				min-width: 100%;
				margin-top: 10px;
				font-family: sans-serif;
				font-size: 0.9em;
			}
			.highcharts-data-table td, .highcharts-data-table th, .highcharts-data-table caption {
				border: 1px solid silver;
				padding: 0.5em;
			}
			.highcharts-data-table tr:nth-child(even), .highcharts-data-table thead tr {
				background: #f8f8f8;
			}
			.highcharts-data-table tr:hover {
				background: #eff;
			}
			.highcharts-data-table caption {
				border-bottom: none;
				font-size: 1.1em;
				font-weight: bold;
				caption-side: top;
			}
		</style>
		<script src="https://stesy.beacontelemetry.com/assets/code/tom-select.base.min.js" defer></script>
		<script src="https://stesy.beacontelemetry.com/assets/code/tabler.min.js" defer></script>
		<script src="https://stesy.beacontelemetry.com/assets/code/demo.min.js" defer></script>

		<script src="https://code.jquery.com/jquery-3.6.0.js"></script>
		<script src="https://code.jquery.com/ui/1.13.2/jquery-ui.js"></script> 
		<script src="<?php echo base_url()?>plugin/datetimepicker/build/jquery.datetimepicker.full.min.js"></script> 

		<!-- mQtt -->
		<script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.js" type="text/javascript"></script>



		<script>

			$( function() {
				$('#dptanggal').datetimepicker(
					{
						timepicker:false,
						format:'Y-m-d',
					});
			} );
		</script>
		<script>
			$( function() {
				$( "#dpbulan" ).datepicker({
					changeMonth: true,
					changeYear: true,
					dateFormat: 'yy-mm',
					onClose: function(dateText, inst) { 
						$(this).datepicker('setDate', new Date(inst.selectedYear, inst.selectedMonth, 1));
					}
				});
			} );
		</script>
		<script>
			$( function() {
				$( "#dptahun" ).datepicker({
					changeYear: true,
					dateFormat:'yy',
					onClose: function(dateText, inst) { 
						$(this).datepicker('setDate', new Date(inst.selectedYear, 1));
					}
				});
			} );
		</script>
		<script>
			$( function() {
				$( "#dpdari" ).datetimepicker({
					format:'Y-m-d H:i'
				});
			} );
		</script>
		<script>
			$( function() {
				$( "#dpsampai" ).datetimepicker({
					format:'Y-m-d H:i'
				});
			} );
		</script>

	</head>
	<body  class="layout-fluid"  <?php if($this->uri->segment(2) == "livedata"){ echo 'onload="init();"';} ?>>
		<div class="page">
			<header class="navbar navbar-expand-md navbar-light d-print-none">
				<div class="container-xl">
					<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu">
						<span class="navbar-toggler-icon"></span>
					</button>
					<h1 class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal py-2 pe-0 pe-md-3">
						<a href="<?= base_url()?>beranda" class="d-none d-sm-block">
							<img src="<?= base_url()?>image/logo_asaba.png"  height="50" alt="Logo Asaba" >
						</a>
					</h1>
					<div class="navbar-nav flex-row order-md-last">
						<div class="nav-item dropdown">
							<div class="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Open user menu" aria-expanded="false">
								<?php if($this->session->userdata('leveluser') == 'admin' or  $this->session->userdata('leveluser') == 'admin_bidang') { ?>
								<span class="avatar avatar-sm " >
									<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-users" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
										<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
										<circle cx="9" cy="7" r="4"></circle>
										<path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
										<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
										<path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path>
									</svg>
								</span>
								<?php }else{?>
								<span class="avatar avatar-sm " >
									<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-users" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
										<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
										<circle cx="9" cy="7" r="4"></circle>
										<path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
										<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
										<path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path>
									</svg>
								</span>
								<?php }?>


								<div class="d-none d-xl-block ps-2">
									<div><?= $this->session->userdata('nama') ?></div>
									<div class="mt-1 small text-muted text-uppercase">
										<?php if($this->session->userdata('leveluser') == 'admin') {
	echo 'Admin';
}elseif($this->session->userdata('leveluser') == 'user'){
	echo 'tamu';
}else{
	echo $this->session->userdata('bidang');
} ?>
									</div>
								</div>
							</div>
						</div>
						<!--            <div class="d-none d-md-flex">
  <a href="?theme=dark" class="nav-link px-0 hide-theme-dark" title="Enable dark mode" data-bs-toggle="tooltip" data-bs-placement="bottom">

 <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" /></svg>
  </a>
  <a href="?theme=light" class="nav-link px-0 hide-theme-light" title="Enable light mode" data-bs-toggle="tooltip" data-bs-placement="bottom">

 <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="4" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
  </a>

 </div>
-->
					</div>
				</div>
			</header>
			<div class="navbar-expand-md">
				<?php $this->load->view('template_admin/menu'); ?>
			</div>
			<div class="page-wrapper">

				<!-- Konten-->
				<?php $this->load->view($konten); ?>
				<!-- end Konten-->



				<footer class="footer footer-transparent d-print-none">
					<div class="container-xl">
						<div class="row text-center align-items-center justify-content-center flex-row-reverse">
							<div class="col-2">
								<img src="<?php echo base_url()?>image/logostesy.png" alt="Beacon Engineering" style="height:60px">
							</div>
						</div>
					</div>
				</footer>
			</div>
		</div>
	</body>
</html>