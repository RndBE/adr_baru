<?php
class M_analisa extends CI_Model {

	function __construct(){
		parent::__construct();
		
	}
//posisi map admin

	function cek_marker($id_logger)
	{
		$awal=date('Y-m-d H:i',(mktime(date('H')-1,0,0,date('m'),date('d'),date('Y'))));

		
		$this->db->where('logger_id',$id_logger);
		
		$this->db->where('waktu >=',$awal);
  		$this->db->where('waktu <=',date('Y-m-d H:i'));
		
		$query=$this->db->get('t_data');
		return $query;
	}

	function cek_marker2($id_logger,$tabel)
	{
		$awal=date('Y-m-d H:i',(mktime(date('H')-1,0,0,date('m'),date('d'),date('Y'))));
		$this->db->select('waktu');
		$this->db->where('code_logger',$id_logger);
		$this->db->where('waktu >=',$awal);
  		//$this->db->where('waktu <=',date('Y-m-d H:i'));
		$query=$this->db->get($tabel);
		return $query;
	}

    function get_posisi()        
	
	{
	
		$this->db->select('*');
		$this->db->from('t_logger');
		//$this->db->join('t_logger', 't_logger.lokasi_id = t_lokasi.id_lokasi');
		//$this->db->where('t_lokasi.user_id',$this->session->userdata('id_user'));
		
		$query=$this->db->get();
		if($query->num_rows() > 0)
		{
			return $query->result();
		}
		else
		{
			echo "Tidak Ada titik Lokasi";
		}

	}

	function sensor($id_logger)
	{
		$this->db->select('*');
		$this->db->from('sensor_logger');
		$this->db->where('logger_id',$id_logger);
		
		$query=$this->db->get();
		if($query->num_rows()>0)
		{
			return $query->result();
		}
		else
		{
		//	echo "Tidak Ada Sensor";
			return array();
		}

	}

	function dataonmarker($id_logger,$sensor)
	{
		$this->db->select('waktu');
		$this->db->select($sensor);
		$this->db->from('t_data');
		$this->db->where('logger_id',$id_logger);
		$this->db->limit('1');
		$this->db->order_by('waktu','desc');
		
		$query=$this->db->get();
		if($query->num_rows()>0)
		{
			return $query->result();
		}
		else
		{
			echo "Tidak Ada titik Lokasi";
			return array();
		}

	}

	function sesi_logger($id_logger)
	{

        $data = $this->db
                ->where('id_logger',$id_logger)
                ->get('t_logger');
        //dicek
        if ($data->num_rows() > 0)
        {
            $logger = $data->row();
            //data hasil seleksi dimasukkan ke dalam $session
            $session = array(
               			
              //  'id_logger' => $logger->id_logger,
            	'lokasi' => $logger->lokasi,
            	'nama_logger'=>$logger->nama_logger
            	
            );
            //data dari $session akhirnya dimasukkan ke dalam session
            $this->session->set_userdata($session);
            return true;
        }
        else
        {
        	echo "Tidak ada logger";
            return false;
        }
    
	}

	function sesi_parametersensorfirst($id_logger,$id_sensor)
	{
		$this->db->where('logger_id',$id_logger);
		$this->db->where('sensor_id',$id_sensor);
		$this->db->limit(1);
       	$data=$this->db->get('parameter_sensor');
       	  if ($data->num_rows() > 0)
        {
            $parameter = $data->row();
            //data hasil seleksi dimasukkan ke dalam $session
            $session = array(
               			
                'id_parameter' => $parameter->id_param,
            	'nama_parameter' => $parameter->nama_parameter,
            	'kolom_sensor'=>$parameter->kolom_sensor,
            	'satuan'=>$parameter->satuan,
            	
            );
            //data dari $session akhirnya dimasukkan ke dalam session
            $this->session->set_userdata($session);
            return true;
        }
        else
        {
        	echo "Tidak ada parameter";
            return false;
        }
    

	}

	function sesi_parametersensor($id_param)
	{
		$this->db->where('id_param',$id_param);		
       	$data=$this->db->get('parameter_sensor');
       	  if ($data->num_rows() > 0)
        {
            $parameter = $data->row();
            //data hasil seleksi dimasukkan ke dalam $session
            $session = array(
               			
                'id_parameter' => $parameter->id_param,
            	'nama_parameter' => $parameter->nama_parameter,
            	'kolom_sensor'=>$parameter->kolom_sensor,
            	'satuan'=>$parameter->satuan,
            	
            );
            //data dari $session akhirnya dimasukkan ke dalam session
            $this->session->set_userdata($session);
            return true;
        }
        else
        {
        	echo "Tidak ada parameter";
            return false;
        }
    

	}

		function sesi_sensor($id_sensor)
	{

        $data = $this->db
                ->where('id_senlog',$id_sensor)
                ->get('sensor_logger');
        //dicek
        if ($data->num_rows() > 0)
        {
            $sensor = $data->row();
            //data hasil seleksi dimasukkan ke dalam $session
            $session = array(
               			
                'id_logger' => $sensor->logger_id,
                'id_sensor' => $sensor->id_senlog,
            	'nama_sensor' => $sensor->nama_sensor,
            	'tabel' => $sensor->tabel         	
            );
            //data dari $session akhirnya dimasukkan ke dalam session
            $this->session->set_userdata($session);
            return true;
        }
        else
        {
        	echo "Tidak ada sensor";
            return false;
        }
    
	}

function analisa()
{
    	if($this->session->userdata('data')=='jam')
	{
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$this->session->userdata('sensor').') as '.$this->session->userdata('alias_sensor'));
			$this->db->select('min('.$this->session->userdata('sensor').') as min');
			$this->db->select('max('.$this->session->userdata('sensor').') as max');
			
			$this->db->where('logger_id',$this->session->userdata('id_logger'));
			$this->db->like('waktu', substr($this->session->userdata('pada'),0,-3), 'after');
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get('t_data');
			return $query;
	}
	elseif($this->session->userdata('data')=='hari')
	{
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$this->session->userdata('sensor').') as '.$this->session->userdata('alias_sensor'));
			$this->db->select('min('.$this->session->userdata('sensor').') as min');
			$this->db->select('max('.$this->session->userdata('sensor').') as max');
			
			$this->db->where('logger_id',$this->session->userdata('id_logger'));
			$this->db->like('waktu', $this->session->userdata('pada'), 'after');
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get('t_data');
			return $query;
	}
	elseif($this->session->userdata('data')=='bulan')
	{
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			
			$this->db->select($this->session->userdata('kolom_sensor'));
		//	$this->db->select('avg('.$this->session->userdata('sensor').') as '.$this->session->userdata('alias_sensor'));
			//$this->db->select('min('.$this->session->userdata('sensor').') as min');
			//$this->db->select('max('.$this->session->userdata('sensor').') as max');
			$this->db->where('id_logger',$this->session->userdata('id_logger'));
			$this->db->where('id_sensor',$this->session->userdata('id_sensor'));
			$this->db->like('waktu', $this->session->userdata('pada'), 'after');
			//$this->db->group_by('DAY(waktu),month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get($this->session->userdata('tabel'));
			return $query;
	}
	elseif($this->session->userdata('data')=='tahun')
	{
			
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$this->session->userdata('sensor').') as '.$this->session->userdata('alias_sensor'));
			$this->db->select('min('.$this->session->userdata('sensor').') as min');
			$this->db->select('max('.$this->session->userdata('sensor').') as max');
			$this->db->where('logger_id',$this->session->userdata('id_logger'));
			$this->db->like('waktu', $this->session->userdata('pada'), 'after');
			$this->db->group_by('month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get('t_data');
			return $query;
	}
	
		elseif($this->session->userdata('data')=='range')
	{
			
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$this->session->userdata('sensor').') as '.$this->session->userdata('alias_sensor'));
			$this->db->select('min('.$this->session->userdata('sensor').') as min');
			$this->db->select('max('.$this->session->userdata('sensor').') as max');
			$this->db->where('logger_id',$this->session->userdata('id_logger'));
			$this->db->where('waktu >=',$this->session->userdata('dari'));
			$this->db->where('waktu <=', $this->session->userdata('sampai'));
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get('t_data');
			return $query;
	}
			
}

function data()
{
    $this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$this->session->userdata('sensor').') as '.$this->session->userdata('alias_sensor'));
			$this->db->where('logger_id',$this->session->userdata('id_logger'));
				$this->db->where('waktu >=',$this->session->userdata('dari'));
				$this->db->where('waktu <=',$this->session->userdata('sampai'));
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get('t_data');
			return $query;
}

	

 
}