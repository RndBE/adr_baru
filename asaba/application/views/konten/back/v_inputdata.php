<div id="content">
  <div id="content-header">
    <div id="breadcrumb"><a href="#"><i class="icon-home"></i> Home</a> <a href="#" class="current"><?php echo ucwords($this->uri->segment(1)); ?></a></div>
  </div>


  <div class="container-fluid">
       
<!----------  ------>
 <div class="row-fluid">
      <div class="span12">
        <div class="widget-box">
          <div class="widget-title"> <span class="icon"> <i class="icon-file"></i> </span>
            <h5>Upload Data CSV</h5>
          </div>
          <div class="widget-content">
             <?php if (isset($error)): ?>
                <div class="alert alert-error"><?php echo $error; ?></div>
            <?php endif; ?>
            <?php if ($this->session->flashdata('success') == TRUE): ?>
                <div class="alert alert-success"><?php echo $this->session->flashdata('success'); ?></div>
            <?php endif; ?>
             
                <?php echo form_open_multipart('inputdata/importcsv');?>
 
               
                    <input type="file" name="userfile" ><br><br>
                    <input type="submit" name="submit" value="UPLOAD" class="btn btn-primary">
                <?php echo form_close()?> 
          </div>
        </div>
      </div>
       
    </div>

  </div>
</div>