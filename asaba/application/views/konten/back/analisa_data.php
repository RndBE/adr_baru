

<div id="content">
  <div id="content-header">
    <div id="breadcrumb"><a href="#"><i class="icon-home"></i> Home</a> <?php echo anchor('analisa',ucwords($this->uri->segment(1)),'class="current"') ?> <a href="#" class="current">Data </a></div>

  </div>


  <div class="container-fluid">
       
<!----------  ------>
 <div class="row-fluid">
 <div class="span12">
     <div class="widget-box">
    <div class="widget-title"> <span class="icon"> <i class="icon-file"></i> </span>
            <h5>Data Logger <?php echo $this->session->userdata('lokasi')?></h5>
          </div>
     <div class="widget-content">
<?php echo form_open('analisa/set_range') ;?>
      
Tanggal 
<input type="input" name="dari" id="dari"  placeholder="Dari" autocomplete="off" /> Sampai 
<input type="input" name="sampai" id="sampai" placeholder="Sampai" autocomplete="off" />
<input type="submit" class="btn btn-success" value="Tampilkan"/>
<?php echo form_close();?>

<?php echo $this->session->userdata('dari') ?>
<?php echo $this->session->userdata('sampai') ?>
              </div>
     
      </div>
     </div>
 </div>
      
</div>



