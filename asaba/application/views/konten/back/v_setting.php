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
			<div class="container-xl">
			 <div class="row">
				 <div class="col-md-3">
					 <div class="card mb-2">
						 <div class="card-body">
							 <h4 class="subheader">Pengaturan AWLR</h4>
							 <div class="list-group list-group-flush">
								 <a href="<?= base_url()?>pengaturan/tingkat_status_awlr" class="list-group-item list-group-item-action <?= ($this->uri->segment(2) == 'tingkat_status_awlr') ? 'active':''?>" aria-current="true">
									 Tingkat Status
								 </a>
								 <a href="<?= base_url()?>pengaturan/rumus_debit_awlr" class="list-group-item list-group-item-action <?= ($this->uri->segment(2) == 'rumus_debit_awlr') ? 'active':''?>">Rumus Debit</a>
							 </div>
							 <h4 class="subheader mt-4">Pengaturan ARR</h4>
							 <div class="list-group list-group-flush ">
								 <a href="<?= base_url()?>pengaturan/tingkat_status_arr" class="list-group-item list-group-item-action <?= ($this->uri->segment(2) == 'tingkat_status_arr') ? 'active':''?>" aria-current="true">
									 Tingkat Status
								 </a>
							 </div>
							 <?php if($this->session->userdata('bidang') == 'teknisi'){?>
							 <h4 class="subheader mt-4">Menu Perbaikan</h4>
							 <div class="list-group list-group-flush ">
								 <a href="<?= base_url()?>pengaturan/perbaikan" class="list-group-item list-group-item-action <?= ($this->uri->segment(2) == 'perbaikan') ? 'active':''?>" aria-current="true">
									 Perbaikan Logger
								 </a>
							 </div>
							 <?php } ?>
						 </div>
					 </div>
				 </div>
     <?php $this->load->view($konten2); ?>
			   </div>
 		</div>