<?php
class M_ketinggian extends CI_Model {

	function __construct(){
		parent::__construct();
		
	}
//posisi map admin

	function sensor_home()
	{

		$this->db->select('*');
		$this->db->from('sensor_home');
		$this->db->join('sensor_logger', 'sensor_logger.id_senlog = sensor_home.sensorlogger_id');
		$query=$this->db->get();
		return $query->result();
	}
	function datasen($idlog,$sensor,$alias_sensor)
	{
			$this->db->select('HOUR(waktu) as jam');
			$this->db->select('DAY(waktu) as hari');
			$this->db->select('MONTH(waktu) as bulan');
			$this->db->select('YEAR(waktu) as tahun');
			$this->db->select('avg('.$sensor.') as '.$alias_sensor);
			$this->db->where('logger_id',$idlog);
			$this->db->like('waktu', $this->session->userdata('pada'), 'after');
			$this->db->group_by('HOUR(waktu),DAY(waktu),month(waktu),YEAR(waktu)');
			$this->db->order_by('waktu');
			$query=$this->db->get('t_data');
			return $query->result();
	}

	function data_terakhir($idlog)
	{

			//$this->db->select('avg(sensor1) as ketinggian');
			$this->db->where('logger_id',$idlog);
			//$this->db->like('waktu', $this->session->userdata('pada'), 'after');
			$this->db->limit(1);

			$this->db->order_by('waktu','desc');
			$query=$this->db->get('t_data');
			return $query->result();
	}


 
}