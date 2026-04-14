  <!-- ##### Header Area Start ##### -->
    <header class="header-area">

        
        <!-- Main Header Area -->
        <div class="main-header-area" id="stickyHeader">
            <div class="classy-nav-container breakpoint-off">
                <!-- Classy Menu -->
                <nav class="classy-navbar justify-content-between" id="southNav">

                    <!-- Logo -->
                    <a class="nav-brand" href="#"><img src="<?php echo base_url()?>image/pu.png" alt=""></a>

                    <!-- Navbar Toggler -->
                    <div class="classy-navbar-toggler">
                        <span class="navbarToggler"><span></span><span></span><span></span></span>
                    </div>

                    <!-- Menu -->
                    <div class="classy-menu">

                        <!-- close btn -->
                        <div class="classycloseIcon">
                            <div class="cross-wrap"><span class="top"></span><span class="bottom"></span></div>
                        </div>

                        <!-- Nav Start -->
                        <div class="classynav">
                            <ul>
                                <li><?php echo anchor('home','Home'); ?></li>
                                <li><?php echo anchor('info','Tentang'); ?></li>
                                 <li><?php echo anchor('data/load_data','Data'); ?></li>
                                 <li><?php echo anchor('kamera','Kamera'); ?></li>
                                <li><?php echo anchor('login','Login'); ?></li>
                            </ul>
                        </div>
                        <!-- Nav End -->
                    </div>
                </nav>
            </div>
        </div>
    </header>