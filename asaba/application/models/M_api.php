<?php
class M_api extends CI_Model{
	public function __construct(){
		parent::__construct();
		
	}

	public  function sensordetail($idsensor,$idlogger)
	{
		$this->db->where('logger_code',$idlogger);
        $this->db->where('id',$idsensor);
		$data=$this->db->get('t_sensor');
		return $data;
	}
	
	function analisa_data($idlogger,$kolom,$namaSensor,$tanggal,$tabel)
	{
		if($tabel == 'weather_station' && $kolom == 'sensor8')
		{
			
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('sum('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $tanggal, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
		elseif($tabel == 'weather_station' && $kolom == 'sensor9')
		{
			
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('sum('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $tanggal, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
		else{

			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $tanggal, 'after'); 
			//$this->db->order_by('waktu');
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
	}
function analisa_databulan($idlogger,$kolom,$namaSensor,$bulan,$tabel)
	{
		if($tabel == 'weather_station' && $kolom == 'sensor8')
		{
			
			
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('sum('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $bulan, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('DAY(waktu),month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
		elseif($tabel == 'weather_station' && $kolom == 'sensor9')
		{
			
			
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('sum('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $bulan, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('DAY(waktu),month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
		else{

			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $bulan, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('DAY(waktu),month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
	}
	
	function analisa_datatahun($idlogger,$kolom,$namaSensor,$bulan,$tabel)
	{
		if($tabel == 'weather_station' && $kolom == 'sensor8')
		{
			
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('sum('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $bulan, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
		elseif($tabel == 'weather_station' && $kolom == 'sensor9')
		{
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('sum('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $bulan, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
		else{

			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$kolom.') as '.$namaSensor);
			$this->db->select('min('.$kolom.') as min');
			$this->db->select('max('.$kolom.') as max');
			$this->db->where('code_logger',$idlogger);
			$this->db->like('waktu', $bulan, 'after'); 
			$this->db->order_by('waktu');
			$this->db->group_by('month(waktu),YEAR(waktu)');
			$query=$this->db->get($tabel);
			return $query;
		}
	}

	
}