<?php
class Mlogin extends CI_Model{



	
	public  function  ambilPengguna($username,$password)
	{
		$sql = "SELECT * FROM t_user WHERE BINARY username = ? AND BINARY password = ?";
		$data = $this->db->query($sql, array($username, $password));
		$device_id = substr(strtoupper(bin2hex(random_bytes(4))), 0, 7);
		//dicek
		if ($data->num_rows() > 0)
		{
			$user = $data->row();
			//data hasil seleksi dimasukkan ke dalam $session
			$session = array(
				'device_id'=>$device_id,
				'logged_in' => true,				
				'username' => $user->username,
				'nama' => $user->nama,
				'latitude' => $user->latitude,
				'longitude' => $user->longitude,
				'leveluser'=>$user->level_user,
				'bidang'=>$user->bidang

			);
			//data dari $session akhirnya dimasukkan ke dalam session
			$this->session->set_userdata($session);
			$garansi_habis = [];
			$data_logger = $this->db->join('t_informasi','t_informasi.logger_id = t_logger.id_logger')->join('t_lokasi', 't_logger.lokasi_logger = t_lokasi.idlokasi')->get('t_logger')->result_array();
			$awal=date('Y-m-d H:i');

			foreach ($data_logger as $k=>$log){
				$id_logger=$log['id_logger'];
				$garansi_warn = date('Y-m-d', strtotime('-30 days', strtotime($log['masa_aktif'])));	
				if($garansi_warn < $awal and $log['masa_aktif'] != '0000-00-00'){
					$now = new DateTime();
					$gr = new DateTime($log['masa_aktif']);
					$subs = $gr->diff($now);
					$garansi_habis[] =[
						'id_logger' =>$id_logger,
						'nama_lokasi' =>$log['nama_lokasi'],
						'garansi' =>$log['masa_aktif'],
						'sub' =>$subs->days,
						'status'=>  date('Y-m-d')> $log['masa_aktif'] ? '0':'1'
					]; 
				}
			}

			if($garansi_habis){
				$this->session->set_flashdata('garansi', 'true');
			}else{
				$this->session->set_flashdata('garansi', 'false');
			}
			return true;
		}
		else
		{
			$this->session->set_flashdata('message', '<div class="alert alert-danger" role="alert"> Kombinasi Username dan Password tidak cocok.</div>');
			redirect('login');
			return false;
		}
	}

	public  function  apiambilPengguna($username,$password)
	{
		$data = $this->db
			->where(array('username' => $username, 'password' => $password))
			->get('t_user');
		//dicek
		if ($data->num_rows() > 0)
		{
			$user = $data->row();
			//data hasil seleksi dimasukkan ke dalam $session
			$session = array(
				// 'logged_in' => true,
				//'level_user' => $user->level_user,
				'username' => $user->username,
				'nama' => $user->nama,
				//'telp' => $user->telp,
				//'alamat' => $user->alamat,
				//'id_user'=>$user->id_user,
				// 'foto'=>'https://beacontelemetry.com/image/user/'.$user->foto,
				//'center_map'=>$user->center_map,
				//'zoom_map'=>$user->zoom_map,
				//'kode_instansi'=>$user->kode_instansi,

			);

			echo json_encode($session);

		}
		else
		{
			echo 'Username dan Password tidak cocok';
		}
	}

	public  function  apiambilPengguna2($username,$password)
	{
		$data = $this->db
			->where(array('username' => $username, 'password' => $password))
			->get('t_user');
		//dicek
		if ($data->num_rows() > 0)
		{
			$user = $data->row();
			//data hasil seleksi dimasukkan ke dalam $session
			$session = array(
				// 'logged_in' => true,
				'level' => $user->level_user,
				'username' => $user->username,
				'nama' => $user->nama,
				'telp' => $user->telp,
				'alamat' => $user->alamat,
				'instansi'=>$user->instansi,
				'latitude'=>$user->latitude,
				'longitude'=>$user->longitude,
				// 'foto'=>'https://beacontelemetry.com/image/user/'.$user->foto,
				//'center_map'=>$user->center_map,
				//'zoom_map'=>$user->zoom_map,
				//'kode_instansi'=>$user->kode_instansi,

			);

			echo json_encode($session);

		}
		else
		{
			echo json_encode(array('nama'=>'error'));
		}
	}
}