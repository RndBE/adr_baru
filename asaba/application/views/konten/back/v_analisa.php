<div class="container-xl">
          <!-- Page title -->
          <div class="page-header d-print-none">
            <div class="row g-2 align-items-center">
              <div class="col">
                <h2 class="page-title">
                  <?php echo ucfirst($this->uri->segment(1))?>
                </h2>
              </div>
            </div>
          </div>
        </div>
        <div class="page-body">
      <!-- Konten-->
      <div class="container-xl">
        <div class="row row-cards">
              <div class="col-md-12">
               <div class="row row-cards">
                  <div class="col-md-12">
                <div class="card">
                  <div class="card-body">
					<div class="row">
						<div class="col-md-2">
                    <div class="strong mb-1"> Analisa Data</div>
                     <?php  
                    $this->load->helper('logger');
                    $cmblogger=loggercombo();
                    echo form_open('analisa/combologger');
                    echo form_dropdown('id_logger',$cmblogger,'','class="form-select" onchange="this.form.submit()" data-placeholder="Cari Lokasi Pos" id="select-pos" value=""');
                    echo form_close();
                ?>
						</div>
					  </div>  
					  
                </div>
              </div>
                </div>
             
          </div>
              </div>
              <div class="col-md-12">
				    <div class="card">
                <div class="card-body">
                    <?php  echo $map['html']; ?>
                  

                  <div id="myID" class="dropdown" style="padding:10px;" >
                          
                        <a href="#" class="btn btn-light" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                          <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-adjustments-horizontal" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="14" cy="6" r="2"></circle>
   <line x1="4" y1="6" x2="12" y2="6"></line>
   <line x1="16" y1="6" x2="20" y2="6"></line>
   <circle cx="8" cy="12" r="2"></circle>
   <line x1="4" y1="12" x2="6" y2="12"></line>
   <line x1="10" y1="12" x2="20" y2="12"></line>
   <circle cx="17" cy="18" r="2"></circle>
   <line x1="4" y1="18" x2="15" y2="18"></line>
   <line x1="19" y1="18" x2="20" y2="18"></line>
</svg>Filter</a>
                        <div class="dropdown-menu" >
                     <!--     <div class="dropdown-item">
                          <label class="form-check">Tampilkan Semua</label>
                          <label class="form-check m-0 ms-auto">
                           
                            <input class="form-check-input m-0 me-2" type="checkbox" name="filter" id="semua" value="" onclick="filterMarkers(this.value);" checked />
                          </label>
                        </div>
                
                   -->
                      <?php
                         $query_kategori=$this->db->query('select * from kategori_logger');
                    foreach ($query_kategori->result()  as $kat) {
                                      ?>
                    <div class="dropdown-divider"></div>  
                    <div class="dropdown-item"><span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/<?php echo $kat->controller ?>.png)"></span>
                          <label class="text-reset"><?php echo $kat->nama_kategori ?> (<?php echo $kat->kepanjangan ?>)</label>
                          <label class="form-check m-0 ms-auto">
                             <input class="form-check-input m-0 me-2" type="checkbox"  id="<?php echo $kat->controller ?>" value="<?php echo $kat->controller ?>" onclick="filterMarkers2(this.value);" checked/>
                          </label>
                        </div> 
                      
                      <?php
                        if($kat->controller == 'awr')
                        {
                          ?><label class="dropdown-item"><input class="form-check-input m-0 me-2" type="checkbox" name="<?php echo $kat->controller ?>" id="<?php echo $kat->controller ?>_aman" value="<?php echo $kat->controller ?>_aman" onclick="toggleGroup(this.value)" checked><span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/kotak-hijau.png)"></span>Koneksi Terhubung</label>
                            <label class="dropdown-item"><input class="form-check-input m-0 me-2" type="checkbox" name="<?php echo $kat->controller ?>" id="<?php echo $kat->controller ?>_off" value="<?php echo $kat->controller ?>_off" onclick="toggleGroup(this.value)" checked> <span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/kotak-merah.png)"></span>Koneksi Terputus</label>
                            <label class="dropdown-item"><input class="form-check-input m-0 me-2" type="checkbox" name="<?php echo $kat->controller ?>" id="<?php echo $kat->controller ?>_perbaikan" value="<?php echo $kat->controller ?>_perbaikan" onclick="toggleGroup(this.value)" checked> <span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/kotak-coklat.png)"></span>Perbaikan</label>

                        <?php
                        } 
                        elseif($kat->controller == 'awlr')
                        {
                          ?>
                            <label class="dropdown-item"><input class="form-check-input m-0 me-2" type="checkbox" name="<?php echo $kat->controller ?>" id="<?php echo $kat->controller ?>_aman" value="<?php echo $kat->controller ?>_aman" onclick="toggleGroup(this.value)" checked><span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/kotak-hijau.png)"></span>Koneksi Terhubung</label>
                            <label class="dropdown-item"><input class="form-check-input m-0 me-2" type="checkbox" name="<?php echo $kat->controller ?>" id="<?php echo $kat->controller ?>_off" value="<?php echo $kat->controller ?>_off" onclick="toggleGroup(this.value)" checked> <span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/kotak-merah.png)"></span>Koneksi Terputus</label>
                            <label class="dropdown-item"><input class="form-check-input m-0 me-2" type="checkbox" name="<?php echo $kat->controller ?>" id="<?php echo $kat->controller ?>_perbaikan" value="<?php echo $kat->controller ?>_perbaikan" onclick="toggleGroup(this.value)" checked> <span class="avatar avatar-xs rounded me-2" style="background-image: url(../pin_marker/kotak-coklat.png)"></span>Perbaikan</label>

                        <?php

                        }    
                     
                        
                       
                         }
                       ?>
                
  
                </div>
              </div>                
                  </div>
				  </div>
                </div>
              </div>
        </div>
      
      </div>
      <!-- end Konten-->
   


<?php echo $map['js']; ?>

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
    });
    // @formatter:on
  </script>
