<style>
	.dropdown-item{
		color:black;
	}
	@media (max-width: 767.98px){
		.navbar-expand-md .navbar-collapse .dropdown-menu .dropdown-item {
			color: white;
		}
	}
</style>
<div class="collapse navbar-collapse bg-dark" id="navbar-menu">
	<div class="navbar" style="border-top: solid 3px #FFD615; background:#303481">
		<div class="container-xl">
			<ul class="navbar-nav">
				<li class="nav-item <?php if($this->uri->segment(1)=='beranda'){ echo 'active';} ?>">
					<?php echo anchor('beranda','<span class="nav-link-icon text-white d-md-none d-lg-inline-block">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><path fill="currentColor" d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Zm1.25 1.171a.25.25 0 0 0-.312 0l-5.25 4.2a.25.25 0 0 0-.094.196v7.019c0 .138.112.25.25.25H5.5V8.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v5.25h2.75a.25.25 0 0 0 .25-.25V6.23a.25.25 0 0 0-.094-.195Z"/></svg>
                    </span>
                    <span class="nav-link-title text-white fw-semibold">
                      Beranda
                    </span>','class="nav-link"')?>

				</li>
				
				<li class="nav-item <?php if($this->uri->segment(2)=='daftar_prisma'  or $this->uri->segment(2)=='analisa'){ echo 'active';} ?>">
					<?php echo anchor('adr/daftar_prisma','<span class="nav-link-icon d-md-none d-lg-inline-block text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2 icon icon-tabler icons-tabler-outline icon-tabler-focus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r=".5" fill="currentColor" /><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg>
                    </span>
                    <span class="nav-link-title text-white fw-semibold">
                      Prism Config 
                    </span>','class="nav-link"')?>

				</li>


				<li class="nav-item">
					<?php echo anchor('login/logout','<span class="nav-link-icon d-md-none d-lg-inline-block text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none"><path d="M24 0v24H0V0h24ZM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035c-.01-.004-.019-.001-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427c-.002-.01-.009-.017-.017-.018Zm.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093c.012.004.023 0 .029-.008l.004-.014l-.034-.614c-.003-.012-.01-.02-.02-.022Zm-.715.002a.023.023 0 0 0-.027.006l-.006.014l-.034.614c0 .012.007.02.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01l-.184-.092Z"/><path fill="currentColor" d="M12 2.5a1.5 1.5 0 0 1 0 3H7a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h4.5a1.5 1.5 0 0 1 0 3H7A3.5 3.5 0 0 1 3.5 18V6A3.5 3.5 0 0 1 7 2.5Zm6.06 5.61l2.829 2.83a1.5 1.5 0 0 1 0 2.12l-2.828 2.83a1.5 1.5 0 1 1-2.122-2.122l.268-.268H12a1.5 1.5 0 0 1 0-3h4.207l-.268-.268a1.5 1.5 0 1 1 2.122-2.121Z"/></g></svg>
                    </span>
                    <span class="nav-link-title  fw-semibold text-white">
                        Keluar
                    </span>','class="nav-link"')?>


				</li>

			</ul>
		</div>
	</div>
</div>