
<html lang="en">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Monitoring Bendungan Bintang Bano</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/bootstrap.min.css" />
<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/bootstrap-responsive.min.css" />
<!--<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/fullcalendar.css" />-->
<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/maruti-style.css" />
<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/maruti-media.css" class="skin-color" />

<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/datepicker.css" />
<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/uniform.css" />
<link rel="stylesheet" href="<?php echo base_url()?>template_back/css/select2.css" />

<script src="<?php echo base_url()?>template_back/js/jquery.min.js"></script> 
<script src="<?php echo base_url()?>template_back/js/jquery.ui.custom.js"></script> 

<link href="https://monitoring4system.com/themeplate/css/bootstrap-datetimepicker.min.css" rel="stylesheet" media="screen"> 


 <script type="text/javascript" src="https://monitoring4system.com/themeplate/js/datepicker/bootstrap-datetimepicker.js" ></script>
<!--<script type="text/javascript" src="https://monitoring4system.com/dist/js/datepicker/bootstrap-datetimepicker.id.js"></script>-->

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
}
</style>
<script type="text/javascript">

$(function () {
    $('#dari,#sampai').datetimepicker();
   
});

</script>

<script type="text/javascript">
 $(document).ready(function(){
    $('.datepicker').datepicker();
     $('.jam').datetimepicker({ 
         format: 'yyyy-mm-dd hh:00',
          minView : 1,
         autoClose: true
     });
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


</head>
<body>


<!--Header-part-->
<div id="header">
  <h1><a href="#">Bendungan Bintang Bano</a></h1>
</div>
<!--close-Header-part--> 



<!--top-Header-menu-->
<div id="user-nav" class="navbar navbar-inverse">
  <ul class="nav">
 <!--   <li class="" ><a title="" href="#"><i class="icon icon-user"></i> <span class="text">Profile</span></a></li>
    <li class=""><a title="" href="#"><i class="icon icon-cog"></i> <span class="text">Settings</span></a></li>
    -->
    <li class=""><?php echo anchor('login/logout','<i class="icon icon-off"></i> <span class="text">Logout</span>'); ?></li>
  </ul>
</div>

<!--close-top-Header-menu-->
<!-- Sidebar -->
<?php $this->load->view('template_admin/sidebar_back'); ?>
<!-- end sidebar -->

<!-- Konten-->
<?php $this->load->view($konten); ?>
<!-- end Konten-->


<div class="row-fluid">
  <div id="footer" class="span12"> 
  <div class="copywrite-text d-flex align-items-center justify-content-center">
      <table style="margin-left:auto; 
  margin-right:auto;">
          <tr><td><img src="<?php echo base_url()?>image/logo_be.png" width="100px"/></td>
          <td style="padding:20px"><img src="<?php echo base_url()?>image/tgu.jpg" width="70px" /></td>
         <!-- <td> <img src="<?php echo base_url()?>image/naufalindo.png" width="200px" height="50px" /></td>-->
          </tr>
      </table>
     
       
        
       
         
        </div>
  &copy; Beacon Engineering 2021. <img src="<?php echo base_url()?>image/logostesy.png" width="75px"  /> </div>
</div>

<script src="<?php echo base_url()?>template_back/js/bootstrap.min.js"></script> 
<script src="<?php echo base_url()?>template_back/js/bootstrap-colorpicker.js"></script> 
<script src="<?php echo base_url()?>template_back/js/bootstrap-datepicker.js"></script> 

<script src="<?php echo base_url()?>template_back/js/jquery.uniform.js"></script> 
<!--<script src="<?php echo base_url()?>template_back/js/select2.min.js"></script> -->
<script src="<?php echo base_url()?>template_back/js/maruti.js"></script> 
<script src="<?php echo base_url()?>template_back/js/maruti.form_common.js"></script>

<script type="text/javascript">
  // This function is called from the pop-up menus to transfer to
  // a different page. Ignore if the value returned is a null string:
  function goPage (newURL) {

      // if url is empty, skip the menu dividers and reset the menu selection to default
      if (newURL != "") {
      
          // if url is "-", it is this page -- reset the menu:
          if (newURL == "-" ) {
              resetMenu();            
          } 
          // else, send page to designated URL            
          else {  
            document.location.href = newURL;
          }
      }
  }

// resets the menu selection upon entry to this page:
function resetMenu() {
   document.gomenu.selector.selectedIndex = 2;
}
</script>
</body>
</html>
