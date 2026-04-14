<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Login extends CI_Controller {

function __construct()
	{
		parent :: __construct();
		$this->load->model('mlogin');
	}

	public function index()
	{
		//$data['konten']='konten/hal_home';
		$this->load->view('loginview');
		
	}

	function validasi_login()
	{
	//	$login= $this->input->post('login');
		 
	
			$this->form_validation->set_message('required', '%s  Harus Diisi.');
			$this->form_validation->set_rules('username', 'Username', 'required');
			$this->form_validation->set_rules('password', 'Password', 'required');
			$this->form_validation->set_error_delimiters('<div class="alert alert-danger" role="alert">', ' </div> <br/>');
	
			if($this->form_validation->run()==FALSE)
			{
				$this->index();
			}
			else
			{
				$username = $this->input->post('username');
				$password = md5($this->input->post('password'));
				$this->mlogin->ambilPengguna($username, $password);
				redirect('beranda');
			}
		
	}
	function logout() {
		$this->session->sess_destroy();
		redirect('login');
	}

	function trace_router($host,$unix)
		{
		$host= preg_replace ("/[^A-Za-z0-9.]/","",$host);
		echo '<pre>';
		//check target IP or domain
		if ($unix)
		{
		system ("traceroute $host");
		system("killall -q traceroute");// kill all traceroute processes in case there are some stalled ones or use echo 'traceroute' to execute without shell
		}
		else
		{
		system("tracert $host");
		}
		echo '</pre>';
		}


	function tesping()
	
		{ 
        	$server='be-jogja.com';
        	echo $this->ping($server);
		}
	function traceroute()
	{
	    $this->trace_router("be-jogja.com",0);
	}
	
}
