<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="description" content="">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <!-- The above 4 meta tags *must* come first in the head; any other head content must come *after* these tags -->

    <!-- Title  -->
    <title>Sistem Monitoring Bendungan Sermo</title>
	<style>
		html,body{
    height: 100%
}
	</style>
    <!-- Style CSS -->
    <link rel="stylesheet" href="<?php echo base_url()?>template_front/style.css">
    
    <link rel="stylesheet" href="<?php echo base_url()?>template_back/css/datepicker.css" />

</head>

<body>
    <!-- Preloader -->
    <div id="preloader">
        <div class="south-load"></div>
    </div>
    <!-- Menu -->

    <?php $this->load->view('template/menu'); ?>
    <!--End Menu -->

    <!-- ##### Konten ##### -->
    <?php $this->load->view($konten); ?>
    <!-- ##### end Konten ##### -->

    <!-- ##### Footer Area Start ##### -->
   <?php $this->load->view('template/footer'); ?>
    <!-- ##### Footer Area End ##### -->

    <!-- jQuery (Necessary for All JavaScript Plugins) -->
    <script src="<?php echo base_url()?>template_front/js/jquery/jquery-2.2.4.min.js"></script>
    <!-- Popper js -->
    <script src="<?php echo base_url()?>template_front/js/popper.min.js"></script>
    <!-- Bootstrap js -->
    <script src="<?php echo base_url()?>template_front/js/bootstrap.min.js"></script>
    <!-- Plugins js -->
    <script src="<?php echo base_url()?>template_front/js/plugins.js"></script>
    <script src="<?php echo base_url()?>template_front/js/classy-nav.min.js"></script>
    <script src="<?php echo base_url()?>template_front/js/jquery-ui.min.js"></script>
    <!-- Active js -->
    <script src="<?php echo base_url()?>template_front/js/active.js"></script>
<script src="<?php echo base_url()?>template_back/js/bootstrap-datepicker.js"></script> 
<script type="text/javascript">
 $(document).ready(function(){
    $('.datepicker').datepicker();
    $('.bulan').datepicker({
              format: 'yyyy-mm',
                viewMode: "months",
                minViewMode: "months",
                autoClose: true
    });
     $('.tgl').datepicker({
              locale: 'ru' ,
              format: 'yyyy-mm-dd',
              autoClose: true
    });

     $('.tahun').datepicker({
              format: "yyyy ",
                viewMode: "years",
                minViewMode: "years",
                 autoClose: true
    });
});

</script>
</body>

</html>